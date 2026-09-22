import "server-only";
import type { Ctx } from "../context";

export async function listPrograms(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("programs")
    .select("id, name, slug, description, age_min, age_max, color, active, invite_only, sort, ranks(count), enrollments(count)")
    .order("sort")
    .order("name");
  if (error) throw new Error(`listPrograms: ${error.message}`);
  return (data ?? []).map((p) => ({
    ...p,
    rankCount: p.ranks[0]?.count ?? 0,
    enrollmentCount: p.enrollments[0]?.count ?? 0,
  }));
}

export async function getProgram(ctx: Ctx, id: string) {
  const { data: program, error } = await ctx.supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getProgram: ${error.message}`);
  if (!program) return null;
  const [ranks, skills] = await Promise.all([
    ctx.supabase
      .from("ranks")
      .select("id, name, belt_color, position, stripes_max, testing_fee_cents, rank_requirements(min_classes, min_days, requires_instructor_approval, notes), rank_skills(skill_id, required)")
      .eq("program_id", id)
      .order("position"),
    ctx.supabase.from("skills").select("id, name, category, program_id").is("archived_at", null).or(`program_id.eq.${id},program_id.is.null`).order("sort").order("name"),
  ]);
  return { program, ranks: ranks.data ?? [], skills: skills.data ?? [] };
}

export async function listSkills(ctx: Ctx, f: { programId?: string; category?: string; q?: string }) {
  let query = ctx.supabase.from("skills").select("*, programs(name)").is("archived_at", null);
  if (f.programId === "shared") query = query.is("program_id", null);
  else if (f.programId) query = query.eq("program_id", f.programId);
  if (f.category) query = query.eq("category", f.category);
  if (f.q) query = query.ilike("name", `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await query.order("sort").order("name").limit(500);
  if (error) throw new Error(`listSkills: ${error.message}`);
  return data ?? [];
}

export async function listLessonPlans(ctx: Ctx) {
  const { data, error } = await ctx.supabase.from("lesson_plans").select("id, name, sections, source, updated_at, programs(name)").eq("is_template", true).order("updated_at", { ascending: false });
  if (error) throw new Error(`listLessonPlans: ${error.message}`);
  return data ?? [];
}
