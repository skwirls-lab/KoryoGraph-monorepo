import "server-only";
import { evaluate, type EligibilityResult } from "@koryo/eligibility";
import type { Ctx } from "../context";

export interface EnrollmentProgress {
  enrollmentId: string;
  programId: string;
  programName: string;
  status: "active" | "paused" | "ended";
  stripes: number;
  stripesMax: number;
  startedAt: string;
  lastPromotedAt: string | null;
  current: { id: string; name: string; color: string } | null;
  next: { id: string; name: string; color: string; feeCents: number } | null;
  classes: { have: number; need: number };
  days: { have: number; need: number };
  skills: { id: string; name: string; signed: boolean }[];
  requiresApproval: boolean;
  approved: boolean;
  eligibility: EligibilityResult;
  ladder: { id: string; name: string; color: string; position: number }[];
  history: { at: string; kind: "promotion" | "stripe" | "signoff" | "approval"; text: string }[];
}

/** Everything the Progress tab (Desk, Mat, Home) needs for one person. RLS decides visibility. */
export async function getPersonProgress(ctx: Ctx, personId: string): Promise<EnrollmentProgress[]> {
  return getProgress(ctx, { personIds: [personId] });
}

/** Batched progress (e.g. a whole class roster) in a fixed number of queries. */
export async function getProgress(ctx: Ctx, f: { personIds?: string[]; enrollmentIds?: string[] }): Promise<(EnrollmentProgress & { personId: string })[]> {
  let q = ctx.supabase.from("v_enrollment_progress").select("*");
  if (f.personIds) q = q.in("person_id", f.personIds);
  if (f.enrollmentIds) q = q.in("enrollment_id", f.enrollmentIds);
  if (!f.personIds?.length && !f.enrollmentIds?.length) return [];
  const { data: rows, error } = await q;
  if (error) throw new Error(`progress: ${error.message}`);
  if (!rows?.length) return [];
  const enrollmentIds = rows.map((r) => r.enrollment_id as string);
  const programIds = [...new Set(rows.map((r) => r.program_id as string))];
  const nextRankIds = rows.map((r) => r.next_rank_id).filter((x): x is string => Boolean(x));

  const [programs, ranks, rankSkills, signoffs, promotions, stripes, approvals] = await Promise.all([
    ctx.supabase.from("programs").select("id, name").in("id", programIds),
    ctx.supabase.from("ranks").select("id, name, belt_color, position, program_id").in("program_id", programIds).order("position"),
    nextRankIds.length ? ctx.supabase.from("rank_skills").select("rank_id, skill_id, skills(name)").in("rank_id", nextRankIds).eq("required", true) : Promise.resolve({ data: [] }),
    ctx.supabase.from("skill_signoffs").select("enrollment_id, skill_id, signed_off_at, score, notes, source, skills(name)").in("enrollment_id", enrollmentIds),
    ctx.supabase.from("promotions").select("enrollment_id, promoted_at, reason, to_rank:ranks!promotions_tenant_id_to_rank_id_fkey(name), from_rank:ranks!promotions_tenant_id_from_rank_id_fkey(name)").in("enrollment_id", enrollmentIds),
    ctx.supabase.from("stripe_awards").select("enrollment_id, awarded_at, note").in("enrollment_id", enrollmentIds),
    ctx.supabase.from("promotion_approvals").select("enrollment_id, rank_id, approved_at, note").in("enrollment_id", enrollmentIds),
  ]);

  const programName = new Map((programs.data ?? []).map((p) => [p.id, p.name]));
  return rows.map((r) => {
    const eid = r.enrollment_id as string;
    const mySignoffs = (signoffs.data ?? []).filter((s) => s.enrollment_id === eid);
    const signed = new Set(mySignoffs.map((s) => s.skill_id));
    const required = (rankSkills.data ?? []).filter((rs) => rs.rank_id === r.next_rank_id);
    const approved = Boolean(r.instructor_approved);
    const requirements = r.next_rank_id
      ? r.min_classes === null && r.min_days === null && required.length === 0 && !r.requires_instructor_approval
        ? null
        : { minClasses: r.min_classes ?? 0, minDays: r.min_days ?? 0, requiredSkillIds: required.map((s) => s.skill_id), requiresApproval: Boolean(r.requires_instructor_approval) }
      : null;
    const eligibility = evaluate({
      enrollment: { status: (r.status ?? "active") as "active" | "paused" | "ended", hasNextRank: Boolean(r.next_rank_id) },
      requirements,
      attendanceCount: r.classes_since_promotion ?? 0,
      daysSince: r.days_since_promotion ?? 0,
      signoffs: [...signed],
      approved,
    });
    const history: EnrollmentProgress["history"] = [
      ...(promotions.data ?? []).filter((p) => p.enrollment_id === eid).map((p) => ({
        at: p.promoted_at, kind: "promotion" as const,
        text: `Promoted ${p.from_rank?.name ? `from ${p.from_rank.name} ` : ""}to ${p.to_rank?.name ?? "?"}${p.reason ? ` — ${p.reason}` : ""}`,
      })),
      ...(stripes.data ?? []).filter((s) => s.enrollment_id === eid).map((s) => ({ at: s.awarded_at, kind: "stripe" as const, text: `Stripe awarded${s.note ? ` — ${s.note}` : ""}` })),
      ...mySignoffs.map((s) => ({ at: s.signed_off_at, kind: "signoff" as const, text: `Signed off ${s.skills?.name ?? "skill"}${s.score !== null ? ` (${s.score})` : ""}${s.source !== "manual" ? ` · ${s.source.replace("_", " ")}` : ""}` })),
      ...(approvals.data ?? []).filter((a) => a.enrollment_id === eid).map((a) => ({ at: a.approved_at, kind: "approval" as const, text: `Approved for next rank${a.note ? ` — ${a.note}` : ""}` })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    return {
      personId: r.person_id as string,
      enrollmentId: eid,
      programId: r.program_id as string,
      programName: programName.get(r.program_id as string) ?? "Program",
      status: (r.status ?? "active") as "active" | "paused" | "ended",
      stripes: r.stripes ?? 0,
      stripesMax: r.stripes_max ?? 0,
      startedAt: r.started_at as string,
      lastPromotedAt: r.last_promoted_at,
      current: r.current_rank_id ? { id: r.current_rank_id, name: r.current_rank_name ?? "", color: r.current_belt_color ?? "#f5f5f5" } : null,
      next: r.next_rank_id ? { id: r.next_rank_id, name: r.next_rank_name ?? "", color: r.next_belt_color ?? "#f5f5f5", feeCents: r.next_testing_fee_cents ?? 0 } : null,
      classes: { have: r.classes_since_promotion ?? 0, need: r.min_classes ?? 0 },
      days: { have: r.days_since_promotion ?? 0, need: r.min_days ?? 0 },
      skills: required.map((s) => ({ id: s.skill_id, name: s.skills?.name ?? "Skill", signed: signed.has(s.skill_id) })),
      requiresApproval: Boolean(r.requires_instructor_approval),
      approved,
      eligibility,
      ladder: (ranks.data ?? []).filter((k) => k.program_id === r.program_id).map((k) => ({ id: k.id, name: k.name, color: k.belt_color, position: k.position })),
      history,
    };
  });
}

export async function programsForEnrollment(ctx: Ctx) {
  const { data } = await ctx.supabase.from("programs").select("id, name, ranks(id, name, position)").eq("active", true).order("sort").order("name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, ranks: [...p.ranks].sort((a, b) => a.position - b.position).map((r) => ({ id: r.id, name: r.name })) }));
}
