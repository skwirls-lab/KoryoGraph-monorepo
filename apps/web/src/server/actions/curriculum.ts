"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney, slugify } from "@/lib/curriculum";
import {
  lessonPlanSchema, programSchema, rankSchema, requirementSchema, skillSchema,
  type LessonPlanInput, type ProgramInput, type RankInput, type RequirementInput, type SkillInput,
} from "@/lib/validation/curriculum";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const num = (v: unknown): number | null => (v === "" || v === undefined || v === null ? null : Number(v));

export async function saveProgram(input: ProgramInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const row = {
    name: v.name, description: v.description, age_min: num(v.ageMin), age_max: num(v.ageMax), color: v.color,
    invite_only: v.inviteOnly, active: v.active,
  };
  if (v.id) {
    const { error } = await ctx.supabase.from("programs").update(row).eq("id", v.id);
    if (error) return fail(error.code === "23514" ? "Minimum age must be below the maximum." : "Couldn't save the program.");
    revalidatePath(`/desk/programs/${v.id}`);
    return ok({ id: v.id });
  }
  let slug = slugify(v.name);
  for (let n = 2; ; n++) {
    const { data } = await ctx.supabase.from("programs").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${slugify(v.name)}-${n}`;
  }
  const { data, error } = await ctx.supabase.from("programs").insert({ ...row, tenant_id: ctx.tenantId as string, slug }).select("id").single();
  if (error || !data) return fail("Couldn't create the program.");
  redirect(`/desk/programs/${data.id}`);
}

export async function saveRank(input: RankInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const parsed = rankSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const fee = parseMoney(v.testingFee);
  if (fee === null) return fail("Enter the fee like 45 or 45.00", { testingFee: "Invalid amount" });
  const row = { name: v.name, belt_color: v.beltColor, stripes_max: v.stripesMax, testing_fee_cents: fee };
  if (v.id) {
    const { error } = await ctx.supabase.from("ranks").update(row).eq("id", v.id);
    if (error) return fail("Couldn't save the rank.");
  } else {
    const { data: last } = await ctx.supabase.from("ranks").select("position").eq("program_id", v.programId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await ctx.supabase.from("ranks").insert({ ...row, tenant_id: ctx.tenantId as string, program_id: v.programId, position: (last?.position ?? 0) + 1 });
    if (error) return fail("Couldn't add the rank.");
  }
  revalidatePath(`/desk/programs/${v.programId}`);
  return ok();
}

export async function deleteRank(input: { rankId: string; programId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const { count } = await ctx.supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("current_rank_id", input.rankId);
  if ((count ?? 0) > 0) return fail(`${count} student${count === 1 ? " holds" : "s hold"} this rank. Move them first.`);
  const { data: rest } = await ctx.supabase.from("ranks").select("id").eq("program_id", input.programId).neq("id", input.rankId).order("position");
  const { error } = await ctx.supabase.from("ranks").delete().eq("id", input.rankId);
  if (error) return fail("Couldn't delete the rank.");
  if (rest?.length) await ctx.supabase.rpc("reorder_ranks", { p_program_id: input.programId, p_rank_ids: rest.map((r) => r.id) });
  revalidatePath(`/desk/programs/${input.programId}`);
  return ok();
}

export async function reorderRanks(input: { programId: string; rankIds: string[] }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const parsed = z.object({ programId: z.uuid(), rankIds: z.array(z.uuid()).min(1).max(100) }).safeParse(input);
  if (!parsed.success) return fail("Invalid order");
  const { error } = await ctx.supabase.rpc("reorder_ranks", { p_program_id: parsed.data.programId, p_rank_ids: parsed.data.rankIds });
  if (error) return fail("Couldn't reorder the ladder.");
  revalidatePath(`/desk/programs/${parsed.data.programId}`);
  return ok();
}

export async function saveRequirement(input: RequirementInput & { programId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const parsed = requirementSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const tenant_id = ctx.tenantId as string;
  const { error } = await ctx.supabase.from("rank_requirements").upsert(
    { tenant_id, rank_id: v.rankId, min_classes: v.minClasses, min_days: v.minDays, requires_instructor_approval: v.requiresApproval, notes: v.notes },
    { onConflict: "rank_id" },
  );
  if (error) return fail("Couldn't save the requirements.");
  const { data: existing } = await ctx.supabase.from("rank_skills").select("skill_id").eq("rank_id", v.rankId);
  const have = new Set((existing ?? []).map((r) => r.skill_id));
  const want = new Set(v.skillIds);
  const remove = [...have].filter((s) => !want.has(s));
  const add = [...want].filter((s) => !have.has(s));
  if (remove.length) await ctx.supabase.from("rank_skills").delete().eq("rank_id", v.rankId).in("skill_id", remove);
  if (add.length) {
    const { error: e } = await ctx.supabase.from("rank_skills").insert(add.map((skill_id) => ({ tenant_id, rank_id: v.rankId, skill_id, required: true })));
    if (e) return fail("Requirements saved, but the skill list couldn't be updated.");
  }
  revalidatePath(`/desk/programs/${input.programId}`);
  return ok();
}

export async function saveSkill(input: SkillInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const parsed = skillSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const row = {
    program_id: v.programId || null, category: v.category, name: v.name, description: v.description,
    video_url: v.videoUrl || null, rubric: v.rubric,
  };
  if (v.id) {
    const { error } = await ctx.supabase.from("skills").update(row).eq("id", v.id);
    if (error) return fail("Couldn't save the skill.");
    revalidatePath("/desk/curriculum");
    return ok({ id: v.id });
  }
  const { data, error } = await ctx.supabase.from("skills").insert({ ...row, tenant_id: ctx.tenantId as string }).select("id").single();
  if (error || !data) return fail("Couldn't create the skill.");
  revalidatePath("/desk/curriculum");
  return ok({ id: data.id });
}

export async function archiveSkill(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const { error } = await ctx.supabase.from("skills").update({ archived_at: new Date().toISOString() }).eq("id", input.id);
  if (error) return fail("Couldn't archive the skill.");
  revalidatePath("/desk/curriculum");
  return ok();
}

export async function saveLessonPlan(input: LessonPlanInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const parsed = lessonPlanSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const row = { name: v.name, program_id: v.programId || null, sections: v.sections, is_template: true };
  if (v.id) {
    const { error } = await ctx.supabase.from("lesson_plans").update(row).eq("id", v.id);
    if (error) return fail("Couldn't save the lesson plan.");
    revalidatePath("/desk/curriculum/lesson-plans");
    return ok({ id: v.id });
  }
  const { data, error } = await ctx.supabase.from("lesson_plans").insert({ ...row, tenant_id: ctx.tenantId as string, created_by: ctx.userId }).select("id").single();
  if (error || !data) return fail("Couldn't create the lesson plan.");
  redirect(`/desk/curriculum/lesson-plans/${data.id}`);
}
