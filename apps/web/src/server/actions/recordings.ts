"use server";

import { randomUUID } from "node:crypto";
import { AiError } from "@koryo/ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { buildBoard } from "../action-board";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const need = { permission: "attendance.write", module: "intelligence" } as const;
const MAX_BYTES = 12 * 1024 * 1024;

async function consentGapNames(sessionId: string): Promise<string[]> {
  const ctx = await getCtx();
  const { data } = await ctx.supabase.rpc("recording_consent_gaps", { p_session_id: sessionId });
  return (data ?? []).map((g) => g.name ?? "a student");
}

/** Upload a class recording (≤ 12 MB); the transcribe job picks it up. Refused if a minor lacks consent. */
export async function uploadRecording(form: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const sessionId = z.uuid().safeParse(form.get("sessionId"));
  const file = form.get("file");
  if (!sessionId.success || !(file instanceof File)) return fail("Choose a recording.");
  if (!file.type.startsWith("audio/") && !file.type.startsWith("video/webm")) return fail("That isn't an audio file.");
  if (file.size > MAX_BYTES) return fail("Recordings can be up to 12 MB (about an hour of speech).");
  if (file.size < 1000) return fail("That recording is empty.");
  const gaps = await consentGapNames(sessionId.data);
  if (gaps.length) return fail(`Can't record: no AI-processing consent for ${gaps.join(", ")}. Take attendance manually or type notes instead.`);
  const ext = (file.name.split(".").pop() ?? "webm").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "webm";
  const path = `${ctx.tenantId}/recordings/${sessionId.data}/${randomUUID()}.${ext}`;
  const { error: upErr } = await ctx.supabase.storage.from("tenant-media").upload(path, file, { contentType: file.type || "audio/webm", upsert: false });
  if (upErr) return fail("Couldn't upload the recording.");
  const { data, error } = await ctx.supabase.from("class_recordings").insert({
    tenant_id: ctx.tenantId as string, session_id: sessionId.data, source: "audio", storage_path: path, mime: file.type, size_bytes: file.size, created_by: ctx.userId,
  }).select("id").single();
  if (error || !data) {
    await ctx.supabase.storage.from("tenant-media").remove([path]);
    return fail(error?.message.includes("consent") ? "Every minor on the roster needs AI-processing consent first." : "Couldn't save the recording.");
  }
  revalidatePath(`/mat/session/${sessionId.data}`);
  return ok({ id: data.id });
}

/** Manual mode: the instructor types (or pastes) what happened; it's analysed into a board right away. */
export async function submitClassNotes(input: { sessionId: string; notes: string }): Promise<ActionResult<{ approvalId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.object({ sessionId: z.uuid(), notes: z.string().trim().min(10, { error: "Write a few sentences about the class" }).max(20_000) }).safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Write a few sentences about the class");
  const { data: rec, error } = await ctx.supabase.from("class_recordings").insert({
    tenant_id: ctx.tenantId as string, session_id: v.data.sessionId, source: "notes", status: "transcribed", transcript: v.data.notes, created_by: ctx.userId,
  }).select("id, tenant_id, session_id").single();
  if (error || !rec) return fail("Couldn't save the notes.");
  try {
    const r = await buildBoard(ctx.supabase, aiFor(ctx), { ...rec, transcript: v.data.notes }, ctx.userId);
    revalidatePath(`/mat/session/${v.data.sessionId}`);
    return ok({ approvalId: r.approvalId });
  } catch (err) {
    const message = err instanceof AiError
      ? err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model" ? "AI isn't configured on this server (no OpenRouter key), so notes can't be turned into a board. Take attendance on the roster instead." : err.message
      : "Couldn't build the board.";
    await ctx.supabase.from("class_recordings").update({ status: "failed", error: message }).eq("id", rec.id);
    revalidatePath(`/mat/session/${v.data.sessionId}`);
    return fail(message);
  }
}
