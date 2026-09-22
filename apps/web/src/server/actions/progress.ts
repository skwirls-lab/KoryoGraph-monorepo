"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const revalidatePerson = (personId?: string) => {
  if (personId) revalidatePath(`/desk/people/${personId}`);
  revalidatePath("/mat", "layout");
  revalidatePath("/home", "layout");
};

const enrollSchema = z.object({
  personId: z.uuid(),
  programId: z.uuid(),
  rankId: z.uuid(),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function enrollInProgram(input: z.input<typeof enrollSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = enrollSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a program and starting rank");
  const v = parsed.data;
  const { error } = await ctx.supabase.from("enrollments").insert({
    tenant_id: ctx.tenantId as string,
    person_id: v.personId,
    program_id: v.programId,
    current_rank_id: v.rankId,
    ...(v.startedAt ? { started_at: v.startedAt } : {}),
  });
  if (error) return fail(error.code === "23505" ? "Already enrolled in this program." : "Couldn't enroll.");
  revalidatePerson(v.personId);
  return ok();
}

export async function promoteEnrollment(input: { enrollmentId: string; toRankId: string; reason: string; personId?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "ranks.promote" });
  if (denied) return denied;
  const parsed = z.object({ enrollmentId: z.uuid(), toRankId: z.uuid(), reason: z.string().trim().min(3, { error: "Give a reason" }).max(500) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid promotion", { reason: parsed.error.issues[0]?.message ?? "" });
  const { error } = await ctx.supabase.rpc("promote", { p_enrollment_id: parsed.data.enrollmentId, p_to_rank_id: parsed.data.toRankId, p_reason: parsed.data.reason });
  if (error) return fail(error.message.includes("not in this program") ? "That rank isn't in this program." : "Couldn't promote.");
  revalidatePerson(input.personId);
  return ok();
}

export async function awardStripe(input: { enrollmentId: string; note?: string; personId?: string }): Promise<ActionResult<{ stripes: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "ranks.promote" });
  if (denied) return denied;
  if (!z.uuid().safeParse(input.enrollmentId).success) return fail("Unknown enrollment");
  const { data, error } = await ctx.supabase.rpc("award_stripe", { p_enrollment_id: input.enrollmentId, p_note: input.note ?? "" });
  if (error) return fail(/maximum|no stripes/.test(error.message) ? error.message.charAt(0).toUpperCase() + error.message.slice(1) : "Couldn't award the stripe.");
  revalidatePerson(input.personId);
  return ok({ stripes: data ?? 0 });
}

export async function signOffSkill(input: { enrollmentId: string; skillId: string; score?: number | null; notes?: string; personId?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "ranks.promote" });
  if (denied) return denied;
  const parsed = z.object({ enrollmentId: z.uuid(), skillId: z.uuid(), score: z.number().min(0).max(100).nullable().optional() }).safeParse(input);
  if (!parsed.success) return fail("Invalid sign-off");
  const { error } = await ctx.supabase.rpc("sign_off_skill", {
    p_enrollment_id: parsed.data.enrollmentId, p_skill_id: parsed.data.skillId, p_score: parsed.data.score ?? undefined, p_notes: input.notes ?? "",
  });
  if (error) return fail("Couldn't sign off the skill.");
  revalidatePerson(input.personId);
  return ok();
}

export async function approveForNextRank(input: { enrollmentId: string; rankId: string; note?: string; personId?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "ranks.promote" });
  if (denied) return denied;
  const parsed = z.object({ enrollmentId: z.uuid(), rankId: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Invalid approval");
  const { error } = await ctx.supabase.from("promotion_approvals").upsert(
    { tenant_id: ctx.tenantId as string, enrollment_id: parsed.data.enrollmentId, rank_id: parsed.data.rankId, approved_by_user_id: ctx.userId, note: input.note || null },
    { onConflict: "enrollment_id,rank_id" },
  );
  if (error) return fail("Couldn't record the approval.");
  revalidatePerson(input.personId);
  return ok();
}

export async function setEnrollmentStatus(input: { enrollmentId: string; status: "active" | "paused" | "ended"; personId?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = z.object({ enrollmentId: z.uuid(), status: z.enum(["active", "paused", "ended"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid status");
  const { error } = await ctx.supabase.from("enrollments").update({ status: parsed.data.status }).eq("id", parsed.data.enrollmentId);
  if (error) return fail("Couldn't update the enrollment.");
  revalidatePerson(input.personId);
  return ok();
}
