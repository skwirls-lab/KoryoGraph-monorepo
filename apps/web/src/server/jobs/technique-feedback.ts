import { createHash } from "node:crypto";
import { AiError, defaultRubric, techniqueFeedback } from "@koryo/ai";
import { weightedOverall, type TechniquePayload } from "@/lib/technique";
import { extractKeyframes } from "../lib/ffmpeg";
import { aiForJob } from "./ai";
import type { Job, JobStats } from "./types";

type Db = Parameters<Job>[0]["db"];
const BUCKET = "tenant-media";

async function download(db: Db, path: string): Promise<Buffer> {
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("The clip couldn't be read from storage.");
  return Buffer.from(await data.arrayBuffer());
}

async function upload(db: Db, path: string, jpg: Buffer): Promise<void> {
  const { error } = await db.storage.from(BUCKET).upload(path, jpg, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Couldn't store a keyframe: ${error.message}`);
}

/** The instructor's reference clip → keyframes, once per clip (stored on the skill). */
async function goldFrames(db: Db, tenantId: string, skill: { id: string; gold_video_path: string | null; gold_keyframe_paths: string[] }): Promise<Buffer[]> {
  if (!skill.gold_video_path) return [];
  let paths = skill.gold_keyframe_paths;
  if (!paths.length) {
    const { frames } = await extractKeyframes(await download(db, skill.gold_video_path), 4);
    paths = frames.map((_, i) => `${tenantId}/gold/${skill.id}/kf-${i + 1}.jpg`);
    for (const [i, f] of frames.entries()) await upload(db, paths[i] as string, f);
    await db.from("skills").update({ gold_keyframe_paths: paths }).eq("id", skill.id);
  }
  return Promise.all(paths.map((p) => download(db, p)));
}

/**
 * Uploaded practice clips (A11) → 6 keyframes (ffmpeg) → rubric feedback (vision tier) → a draft in the
 * instructor's review queue. The student sees nothing until an instructor releases it.
 */
export const techniqueFeedbackJob: Job = async ({ db, tenantId, log }) => {
  let q = db.from("technique_submissions").select("id, tenant_id, person_id, video_path, created_by, skills(id, name, category, description, rubric, gold_video_path, gold_keyframe_paths), people(first_name, preferred_name)")
    .eq("status", "uploaded").order("created_at").limit(3);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: subs, error } = await q;
  if (error) throw new Error(`technique_submissions: ${error.message}`);
  const ai = aiForJob(db);
  const stats: JobStats = { processed: 0, review: 0, failed: 0 };
  for (const s of subs ?? []) {
    stats.processed = Number(stats.processed) + 1;
    await db.from("technique_submissions").update({ status: "processing", error: null }).eq("id", s.id);
    try {
      const skill = s.skills;
      if (!skill) throw new Error("The skill no longer exists.");
      const video = await download(db, s.video_path);
      const { durationMs, frames } = await extractKeyframes(video, 6);
      if (durationMs > 61_000) throw new Error("The clip is longer than 60 seconds; please trim it and upload again.");
      const keyframePaths = frames.map((_, i) => `${s.tenant_id}/technique/${s.person_id}/${s.id}/kf-${i + 1}.jpg`);
      for (const [i, f] of frames.entries()) await upload(db, keyframePaths[i] as string, f);
      await db.from("technique_submissions").update({ keyframe_paths: keyframePaths, duration_ms: durationMs }).eq("id", s.id);

      const rubricRaw = Array.isArray(skill.rubric) ? (skill.rubric as { criterion?: unknown; weight?: unknown }[]) : [];
      const rubric = rubricRaw.filter((r) => typeof r.criterion === "string" && typeof r.weight === "number").map((r) => ({ criterion: r.criterion as string, weight: r.weight as number }));
      const useRubric = rubric.length ? rubric.slice(0, 8) : defaultRubric(skill.category);
      const gold = await goldFrames(db, s.tenant_id, skill);
      const r = await ai.runTask(techniqueFeedback, {
        skill: skill.name, category: skill.category, description: skill.description, rubric: useRubric,
        frames: frames.map((f) => f.toString("base64")), goldFrames: gold.map((f) => f.toString("base64")),
        sha256: createHash("sha256").update(video).digest("hex"),
      }, { tenantId: s.tenant_id, userId: s.created_by });

      const student = s.people?.preferred_name || s.people?.first_name || "Student";
      const payload: TechniquePayload = {
        submission_id: s.id, person_id: s.person_id, skill: skill.name,
        feedback: { scores: r.output.scores.map((x) => ({ ...x, weight: useRubric.find((u) => u.criterion.toLowerCase() === x.criterion.toLowerCase())?.weight ?? 0 })), overall: weightedOverall(r.output.scores, useRubric), summary: r.output.summary, tips: r.output.tips },
      };
      const { data: item, error: e } = await db.from("approval_items").insert({
        tenant_id: s.tenant_id, kind: "vision_feedback", title: `${skill.name} · ${student}`, person_id: s.person_id, ai_run_id: r.runId,
        entity_type: "technique_submission", entity_id: s.id,
        preview: `Practice clip (${Math.round(durationMs / 1000)} s) · overall ${payload.feedback.overall}/5${r.fixture ? " · dev fixture" : ""}`,
        payload,
      }).select("id").single();
      if (e || !item) throw new Error(`Couldn't queue the review: ${e?.message ?? "unknown"}`);
      await db.from("technique_submissions").update({ status: "review", ai_run_id: r.runId, approval_item_id: item.id }).eq("id", s.id);
      stats.review = Number(stats.review) + 1;
    } catch (err) {
      const message = err instanceof AiError
        ? err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model" ? "AI feedback isn't configured on this server (no OpenRouter key), so this clip couldn't be analysed." : err.message
        : err instanceof Error ? err.message : String(err);
      await db.from("technique_submissions").update({ status: "failed", error: message.slice(0, 500) }).eq("id", s.id);
      stats.failed = Number(stats.failed) + 1;
      log.warn({ submission: s.id, err: message }, "technique feedback failed");
    }
  }
  return stats;
};
