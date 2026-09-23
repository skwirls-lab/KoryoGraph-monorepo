import { createHash } from "node:crypto";
import { AiError, transcribe } from "@koryo/ai";
import { buildBoard } from "../action-board";
import { toSpeechMp3 } from "../lib/ffmpeg";
import { aiForJob } from "./ai";
import type { Job, JobStats } from "./types";

/** Uploaded class recordings → transcript (audio tier) → draft action board in Approvals. */
export const transcribeJob: Job = async ({ db, tenantId, log }) => {
  let q = db.from("class_recordings").select("id, tenant_id, session_id, storage_path, created_by").eq("status", "uploaded").eq("source", "audio").order("created_at").limit(5);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: recs, error } = await q;
  if (error) throw new Error(`class_recordings: ${error.message}`);
  const ai = aiForJob(db);
  const stats: JobStats = { processed: 0, ready: 0, failed: 0 };
  for (const rec of recs ?? []) {
    stats.processed = Number(stats.processed) + 1;
    await db.from("class_recordings").update({ status: "transcribing", error: null }).eq("id", rec.id);
    try {
      const { data: file, error: dlErr } = await db.storage.from("tenant-media").download(rec.storage_path ?? "");
      if (dlErr || !file) throw new Error("The recording file couldn't be read.");
      const original = Buffer.from(await file.arrayBuffer());
      const mp3 = await toSpeechMp3(original);
      const sha256 = createHash("sha256").update(original).digest("hex");
      const t = await ai.runTask(transcribe, { audioBase64: mp3.toString("base64"), format: "mp3", sha256 }, { tenantId: rec.tenant_id, userId: rec.created_by });
      await db.from("class_recordings").update({ status: "transcribed", transcript: t.output.transcript }).eq("id", rec.id);
      await buildBoard(db, ai, { id: rec.id, tenant_id: rec.tenant_id, session_id: rec.session_id, transcript: t.output.transcript }, rec.created_by);
      stats.ready = Number(stats.ready) + 1;
    } catch (err) {
      const message = err instanceof AiError
        ? err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model" ? "AI transcription isn't configured on this server (no OpenRouter key). Type the class notes instead." : err.message
        : err instanceof Error ? err.message : String(err);
      await db.from("class_recordings").update({ status: "failed", error: message.slice(0, 500) }).eq("id", rec.id);
      stats.failed = Number(stats.failed) + 1;
      log.warn({ recording: rec.id, err: message }, "transcribe failed");
    }
  }
  return stats;
};
