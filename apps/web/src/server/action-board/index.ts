import "server-only";
import { actionBoard, type Ai } from "@koryo/ai";
import type { ServerClient } from "@koryo/db/server";
import type { Json } from "@koryo/db/types";
import { z } from "zod";

type Db = ServerClient;

export const LOW_CONFIDENCE = 0.7;

export const boardPayloadSchema = z.object({
  session_id: z.uuid(),
  recording_id: z.uuid(),
  ignored: z.number().int().default(0),
  attendance: z.array(z.object({ person_id: z.uuid(), name: z.string(), evidence: z.string(), confidence: z.number(), include: z.boolean() })),
  skill_notes: z.array(z.object({ person_id: z.uuid(), name: z.string(), enrollment_id: z.uuid().nullable(), skill_id: z.uuid().nullable(), skill_name: z.string().nullable(), note: z.string(), sign_off: z.boolean(), confidence: z.number(), include: z.boolean() })),
  injuries: z.array(z.object({ person_id: z.uuid(), name: z.string(), note: z.string(), confidence: z.number(), include: z.boolean() })),
  follow_ups: z.array(z.object({ title: z.string(), person_id: z.uuid().nullable(), name: z.string().nullable(), include: z.boolean() })),
});
export type BoardPayload = z.infer<typeof boardPayloadSchema>;

/** Roster (with the enrollment in this class's programs) and the skills those programs teach. */
export async function sessionContext(db: Db, sessionId: string) {
  const [{ data: session }, { data: roster }] = await Promise.all([
    db.from("class_sessions").select("id, tenant_id, name, program_ids").eq("id", sessionId).maybeSingle(),
    db.from("v_class_roster").select("person_id, display_name, enrollment_id").eq("session_id", sessionId),
  ]);
  if (!session) return null;
  const { data: ranks } = session.program_ids.length ? await db.from("ranks").select("id").in("program_id", session.program_ids) : { data: [] };
  const [{ data: own }, { data: req }] = await Promise.all([
    session.program_ids.length ? db.from("skills").select("id, name").in("program_id", session.program_ids).is("archived_at", null) : Promise.resolve({ data: [] }),
    ranks?.length ? db.from("rank_skills").select("skills(id, name)").in("rank_id", ranks.map((r) => r.id)) : Promise.resolve({ data: [] }),
  ]);
  const skills = new Map<string, string>();
  for (const s of own ?? []) skills.set(s.id, s.name);
  for (const r of (req ?? []) as { skills: { id: string; name: string } | null }[]) if (r.skills) skills.set(r.skills.id, r.skills.name);
  return {
    session,
    roster: (roster ?? []).filter((r) => r.person_id).map((r) => ({ personId: r.person_id as string, name: r.display_name ?? "", enrollmentId: r.enrollment_id })),
    skills: [...skills.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Analyse a transcript into a draft board and file it in Approvals. Everything the model returns is checked
 * against the real roster and skill list; rows about unknown people or skills are dropped (and counted).
 */
export async function buildBoard(db: Db, ai: Ai, recording: { id: string; tenant_id: string; session_id: string; transcript: string }, userId: string | null): Promise<{ approvalId: string; fixture: boolean }> {
  const ctx = await sessionContext(db, recording.session_id);
  if (!ctx) throw new Error("Class not found.");
  await db.from("class_recordings").update({ status: "analyzing", error: null }).eq("id", recording.id);
  const r = await ai.runTask(actionBoard, { className: ctx.session.name, transcript: recording.transcript, roster: ctx.roster.map(({ personId, name }) => ({ personId, name })), skills: ctx.skills }, { tenantId: recording.tenant_id, userId });
  const who = new Map(ctx.roster.map((p) => [p.personId, p]));
  const skillName = new Map(ctx.skills.map((s) => [s.id, s.name]));
  let ignored = 0;
  const known = <T extends { personId: string }>(rows: T[]) => rows.filter((x) => { const ok = who.has(x.personId); if (!ok) ignored += 1; return ok; });
  const seen = new Set<string>();
  const payload: BoardPayload = {
    session_id: recording.session_id, recording_id: recording.id, ignored: 0,
    attendance: known(r.output.attendance).filter((a) => !seen.has(a.personId) && seen.add(a.personId)).map((a) => ({ person_id: a.personId, name: who.get(a.personId)?.name ?? "", evidence: a.evidence, confidence: a.confidence, include: a.confidence >= LOW_CONFIDENCE })),
    skill_notes: known(r.output.skillNotes).map((s) => {
      const skillId = s.skillId && skillName.has(s.skillId) ? s.skillId : null;
      if (s.skillId && !skillId) ignored += 1;
      return { person_id: s.personId, name: who.get(s.personId)?.name ?? "", enrollment_id: who.get(s.personId)?.enrollmentId ?? null, skill_id: skillId, skill_name: skillId ? skillName.get(skillId) ?? null : null,
        note: s.note, sign_off: s.signOff && Boolean(skillId) && Boolean(who.get(s.personId)?.enrollmentId), confidence: s.confidence, include: s.confidence >= LOW_CONFIDENCE };
    }),
    injuries: known(r.output.injuries).map((x) => ({ person_id: x.personId, name: who.get(x.personId)?.name ?? "", note: x.note, confidence: x.confidence, include: x.confidence >= LOW_CONFIDENCE })),
    follow_ups: r.output.followUps.map((f) => ({ title: f.title, person_id: f.personId && who.has(f.personId) ? f.personId : null, name: f.personId ? who.get(f.personId)?.name ?? null : null, include: true })),
  };
  payload.ignored = ignored;
  const { data: item, error } = await db.from("approval_items").insert({
    tenant_id: recording.tenant_id, kind: "action_board", title: `Action board: ${ctx.session.name}`, entity_type: "class_session", entity_id: recording.session_id, ai_run_id: r.runId, requested_by: userId,
    preview: `${payload.attendance.length} attendance · ${payload.skill_notes.length} skill notes · ${payload.injuries.length} injuries · ${payload.follow_ups.length} follow-ups${ignored ? ` · ${ignored} item(s) about unknown people/skills ignored` : ""}`,
    payload: payload as unknown as Json,
  }).select("id").single();
  if (error || !item) throw new Error(`approval_items: ${error?.message}`);
  await db.from("class_recordings").update({ status: "ready", approval_item_id: item.id }).eq("id", recording.id);
  return { approvalId: item.id, fixture: r.fixture };
}

/** Carry out an approved board atomically in the database (execute_action_board); runs at most once. */
export async function executeBoard(db: Db, itemId: string, raw: unknown): Promise<{ ok: true; summary: string; detail?: Record<string, unknown> } | { ok: false; error: string }> {
  if (!boardPayloadSchema.safeParse(raw).success) return { ok: false, error: "The board changed shape; open it again." };
  const { data, error } = await db.rpc("execute_action_board", { p_id: itemId });
  if (error) return { ok: false, error: error.code === "42501" ? "Approving a board needs attendance and approval permissions." : error.message };
  const r = data as { ok: boolean; summary: string; detail: Record<string, unknown> };
  return { ok: true, summary: r.summary, detail: r.detail };
}
