"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { MAX_CLIP_BYTES } from "@/lib/technique";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const need = { permission: "home.access", module: "vision" } as const;

/** A guardian records AI-processing consent for a student in their household (RLS: guardians only, or an adult for themselves). */
export async function grantAiConsent(input: { personId: string; skillId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.object({ personId: z.uuid(), skillId: z.uuid() }).safeParse(input);
  if (!v.success) return fail("Choose a student.");
  const { data: me } = await ctx.supabase.rpc("my_person_id");
  if (!me) return fail("Your account isn't linked to a family member yet; ask the school.");
  const { error } = await ctx.supabase.from("consents").insert({
    tenant_id: ctx.tenantId as string, person_id: v.data.personId, guardian_person_id: me, kind: "ai_processing", granted: true, method: "home",
  });
  if (error) return fail(error.code === "42501" ? "Only a parent or guardian can give consent for a student under 18." : "Couldn't record the consent.");
  revalidatePath(`/home/progress/${v.data.skillId}/submit`);
  return ok();
}

/** Register a clip the browser has uploaded to "<tenant>/technique/<person>/…"; the technique job analyses it. */
export async function submitTechnique(input: { personId: string; skillId: string; path: string; durationMs: number; note?: string }): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.object({
    personId: z.uuid(), skillId: z.uuid(), path: z.string().min(10).max(300),
    durationMs: z.number().int().min(500, { error: "That clip is too short." }).max(61_000, { error: "Clips can be up to 60 seconds." }),
    note: z.string().trim().max(500).optional(),
  }).safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Check the clip.");
  const folder = `${ctx.tenantId}/technique/${v.data.personId}`;
  const name = v.data.path.slice(folder.length + 1);
  if (!v.data.path.startsWith(`${folder}/`) || !/^[\w-]+\.(mp4|mov|webm|m4v|3gp)$/i.test(name)) return fail("Upload the clip first.");
  const { data: files } = await ctx.supabase.storage.from("tenant-media").list(folder, { search: name, limit: 1 });
  const file = files?.find((f) => f.name === name);
  const size = Number((file?.metadata as { size?: number } | null)?.size ?? 0);
  if (!file) return fail("The upload didn't finish; try again.");
  if (size > MAX_CLIP_BYTES) {
    await ctx.supabase.storage.from("tenant-media").remove([v.data.path]);
    return fail("Clips can be up to 50 MB.");
  }
  const { data, error } = await ctx.supabase.rpc("submit_technique", { p_person_id: v.data.personId, p_skill_id: v.data.skillId, p_video_path: v.data.path, p_duration_ms: v.data.durationMs, p_note: v.data.note ?? undefined });
  if (error || !data) {
    await ctx.supabase.storage.from("tenant-media").remove([v.data.path]);
    const m = error?.message ?? "";
    return fail(m.includes("consent") ? "A parent or guardian needs to give AI-processing consent first." : m.includes("already 3") ? "There are already 3 clips waiting for review for this student." : error?.code === "42501" ? "You can only submit clips for students in your family." : "Couldn't submit the clip.");
  }
  revalidatePath(`/home/progress/${v.data.skillId}/submit`);
  return ok({ id: data });
}

/** Desk → Curriculum: set a skill's reference ("gold standard") clip, already uploaded to "<tenant>/gold/<skill>/…". */
export async function setGoldClip(input: { skillId: string; path: string | null }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write", module: "vision" });
  if (denied) return denied;
  const v = z.object({ skillId: z.uuid(), path: z.string().max(300).nullable() }).safeParse(input);
  if (!v.success) return fail("Invalid clip.");
  const folder = `${ctx.tenantId}/gold/${v.data.skillId}`;
  if (v.data.path !== null) {
    const name = v.data.path.slice(folder.length + 1);
    if (!v.data.path.startsWith(`${folder}/`) || !/^[\w-]+\.(mp4|mov|webm|m4v|3gp)$/i.test(name)) return fail("Upload the clip first.");
    const { data: files } = await ctx.supabase.storage.from("tenant-media").list(folder, { search: name, limit: 1 });
    if (!files?.some((f) => f.name === name)) return fail("The upload didn't finish; try again.");
  }
  // New clip → keyframes are re-extracted by the technique job on next use.
  const { data, error } = await ctx.supabase.from("skills").update({ gold_video_path: v.data.path, gold_keyframe_paths: [] }).eq("id", v.data.skillId).select("id");
  if (error || !data?.length) return fail("Couldn't save the reference clip.");
  revalidatePath("/desk/curriculum");
  return ok();
}
