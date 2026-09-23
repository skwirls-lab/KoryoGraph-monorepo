"use server";

import { AiError, lessonBuilder } from "@koryo/ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { LessonSection } from "@/lib/curriculum";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const need = { permission: "curriculum.write", module: "intelligence" } as const;

export interface DraftPlan { name: string; week: number; sections: LessonSection[] }
export interface Drafts { plans: DraftPlan[]; suggested: { name: string; category: string; reason: string }[]; dropped: number; fixture: boolean; runId: string | null; skillNames: Record<string, string> }

const genSchema = z.object({
  programId: z.uuid({ error: "Choose a program" }),
  rankFrom: z.coerce.number().int().min(0).default(0),
  rankTo: z.coerce.number().int().min(0).default(0),
  weeks: z.coerce.number().int().min(1).max(12),
  minutes: z.coerce.number().int().min(15).max(180),
  prompt: z.string().trim().min(5, { error: "Describe what you want to teach" }).max(1000),
});

/** Draft lesson plans from the school's own skill library; unknown skill ids are dropped, never saved. */
export async function generateLessonPlans(input: z.input<typeof genSchema>): Promise<ActionResult<Drafts>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form");
  const v = parsed.data;
  const [{ data: program }, { data: ranks }, { data: skills }] = await Promise.all([
    ctx.supabase.from("programs").select("id, name").eq("id", v.programId).maybeSingle(),
    ctx.supabase.from("ranks").select("name, position").eq("program_id", v.programId).order("position"),
    ctx.supabase.from("skills").select("id, name, category, program_id").or(`program_id.eq.${v.programId},program_id.is.null`).is("archived_at", null).order("sort").limit(400),
  ]);
  if (!program) return fail("Program not found.");
  const band = (ranks ?? []).filter((r) => (!v.rankFrom || r.position >= v.rankFrom) && (!v.rankTo || r.position <= v.rankTo)).map((r) => r.name);
  const library = new Map((skills ?? []).map((s) => [s.id, s.name]));
  try {
    const r = await aiFor(ctx).runTask(lessonBuilder, {
      prompt: v.prompt, programName: program.name, rankBand: band, weeks: v.weeks, classMinutes: v.minutes,
      skills: (skills ?? []).map((s) => ({ id: s.id, name: s.name, category: s.category })),
    }, { tenantId: ctx.tenantId as string, userId: ctx.userId });
    let dropped = 0;
    const plans = r.output.plans.map((p) => ({
      name: p.name, week: p.week,
      sections: p.sections.map((s) => {
        const ids = s.skillIds.filter((id) => library.has(id));
        dropped += s.skillIds.length - ids.length;
        return { title: s.title, minutes: s.minutes, skill_ids: ids, notes: s.notes };
      }),
    })).sort((a, b) => a.week - b.week);
    const used = new Set(plans.flatMap((p) => p.sections.flatMap((s) => s.skill_ids)));
    return ok({ plans, suggested: r.output.suggestedSkills, dropped, fixture: r.fixture, runId: r.runId, skillNames: Object.fromEntries([...used].map((id) => [id, library.get(id) ?? ""])) });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return fail(err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model"
      ? "AI isn't configured on this server (no OpenRouter key) and this prompt isn't a recorded dev example. Build the plan by hand in Lesson plans."
      : err.message);
  }
}

const saveSchema = z.object({
  programId: z.uuid(),
  runId: z.uuid().nullable(),
  plans: z.array(z.object({
    name: z.string().trim().min(2).max(120),
    week: z.number().int(),
    sections: z.array(z.object({ title: z.string().trim().min(1).max(80), minutes: z.number().int().min(0).max(240), skill_ids: z.array(z.uuid()).max(50), notes: z.string().max(2000) })).min(1).max(20),
    /** Optional: attach this plan to a class. */
    sessionId: z.uuid().nullish(),
  })).min(1).max(12),
});

export async function saveGeneratedPlans(input: z.input<typeof saveSchema>): Promise<ActionResult<{ ids: string[]; assigned: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the plans");
  const v = parsed.data;
  // Re-check every skill id against the library at save time.
  const ids = [...new Set(v.plans.flatMap((p) => p.sections.flatMap((s) => s.skill_ids)))];
  const { data: known } = ids.length ? await ctx.supabase.from("skills").select("id").in("id", ids) : { data: [] };
  const ok_ = new Set((known ?? []).map((k) => k.id));
  const { data, error } = await ctx.supabase.from("lesson_plans").insert(v.plans.map(({ sessionId: _s, ...p }) => ({
    tenant_id: ctx.tenantId as string, program_id: v.programId, name: p.name, is_template: true, source: "ai", ai_run_id: v.runId, created_by: ctx.userId,
    sections: p.sections.map((s) => ({ ...s, skill_ids: s.skill_ids.filter((id) => ok_.has(id)) })),
  }))).select("id");
  if (error || !data) return fail("Couldn't save the plans.");
  let assigned = 0;
  for (const [i, p] of v.plans.entries()) {
    const planId = data[i]?.id;
    if (!planId || !p.sessionId) continue;
    const { error: aErr } = await ctx.supabase.from("class_sessions").update({ lesson_plan_id: planId }).eq("id", p.sessionId);
    if (!aErr) assigned += 1;
    revalidatePath(`/mat/session/${p.sessionId}`);
  }
  revalidatePath("/desk/curriculum/lesson-plans");
  return ok({ ids: data.map((d) => d.id), assigned });
}
