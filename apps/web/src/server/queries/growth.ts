import "server-only";
import { describeGap, type EligibilityStatus } from "@koryo/eligibility";
import type { Ctx } from "../context";
import { fetchAll } from "../lib/fetch-all";
import { getProgress } from "./progress";

export interface FunnelRow { period: string; source: string; leads: number; booked: number; attended: number; won: number; lost: number }

/** Trial funnel for the last `months` school-local months (by the month each lead arrived). */
export async function trialFunnel(ctx: Ctx, fromPeriod: string): Promise<FunnelRow[]> {
  const rows = await fetchAll((from, to) => ctx.supabase.from("v_trial_funnel").select("*").gte("period", fromPeriod).order("period").range(from, to));
  return rows.map((r) => ({ period: r.period ?? "", source: r.source ?? "unknown", leads: r.leads ?? 0, booked: r.trials_booked ?? 0, attended: r.trials_attended ?? 0, won: r.won ?? 0, lost: r.lost ?? 0 }));
}

export interface CohortRow { cohort: string; size: number; retained: number[] }

/** Retention cohorts starting at or after `fromCohort` (YYYY-MM); retained[k] = members at the end of month k. */
export async function retentionCohorts(ctx: Ctx, fromCohort: string): Promise<CohortRow[]> {
  const rows = await fetchAll((from, to) => ctx.supabase.from("v_retention_cohorts").select("cohort, month_index, cohort_size, retained").gte("cohort", fromCohort).order("cohort").order("month_index").range(from, to));
  const by = new Map<string, CohortRow>();
  for (const r of rows) {
    const c = by.get(r.cohort ?? "") ?? { cohort: r.cohort ?? "", size: r.cohort_size ?? 0, retained: [] };
    c.retained[r.month_index ?? 0] = r.retained ?? 0;
    by.set(c.cohort, c);
  }
  return [...by.values()];
}

export interface ChurnRow { membershipId: string; personId: string; name: string; plan: string; status: string; startsAt: string; endedOn: string; tenureMonths: number; reason: string; stillMember: boolean }

export async function churnList(ctx: Ctx, fromDate: string): Promise<ChurnRow[]> {
  const rows = await fetchAll((from, to) => ctx.supabase.from("v_churn_list").select("*").gte("ended_on", fromDate).order("ended_on", { ascending: false }).range(from, to));
  return rows.map((r) => ({
    membershipId: r.membership_id ?? "", personId: r.person_id ?? "", name: r.person_name ?? "", plan: r.plan_name ?? "", status: r.status ?? "", startsAt: r.starts_at ?? "",
    endedOn: r.ended_on ?? "", tenureMonths: r.tenure_months ?? 0, reason: r.reason ?? "", stillMember: Boolean(r.still_member),
  }));
}

export interface EligibilityRow { enrollmentId: string; personId: string; name: string; program: string; currentRank: string | null; nextRank: string | null; status: EligibilityStatus; gaps: string[] }

/** Every active enrollment's standing for its next rank, from the eligibility engine. */
export async function eligibilityReport(ctx: Ctx): Promise<EligibilityRow[]> {
  const enrollments = await fetchAll((from, to) => ctx.supabase.from("enrollments").select("id, person_id, people(first_name, last_name, preferred_name)").eq("status", "active").range(from, to));
  const names = new Map(enrollments.map((e) => [e.id, e.people ? `${e.people.preferred_name || e.people.first_name} ${e.people.last_name}`.trim() : "Student"]));
  const out: EligibilityRow[] = [];
  for (let i = 0; i < enrollments.length; i += 150) {
    for (const p of await getProgress(ctx, { enrollmentIds: enrollments.slice(i, i + 150).map((e) => e.id) })) {
      const skills = new Map(p.skills.map((s) => [s.id, s.name]));
      out.push({
        enrollmentId: p.enrollmentId, personId: p.personId, name: names.get(p.enrollmentId) ?? "Student", program: p.programName, currentRank: p.current?.name ?? null,
        nextRank: p.next?.name ?? null, status: p.eligibility.status, gaps: p.eligibility.gaps.map((g) => describeGap(g, (id) => skills.get(id) ?? id)),
      });
    }
  }
  return out.sort((a, b) => a.program.localeCompare(b.program) || a.name.localeCompare(b.name));
}

export interface StaffSessionsRow { userId: string; name: string; period: string; sessions: number; hours: number }

export async function staffSessions(ctx: Ctx, fromPeriod: string): Promise<StaffSessionsRow[]> {
  const rows = await fetchAll((from, to) => ctx.supabase.from("v_staff_sessions").select("*").gte("period", fromPeriod).order("period").range(from, to));
  return rows.map((r) => ({ userId: r.user_id ?? "", name: r.staff_name ?? "Staff", period: r.period ?? "", sessions: r.sessions ?? 0, hours: Number(r.hours ?? 0) }));
}

export interface EventRevenueRow { eventId: string; kind: string; name: string; startsAt: string; status: string; registrations: number; invoiced: number; paid: number; outstanding: number }

export async function eventRevenue(ctx: Ctx, fromIso: string): Promise<EventRevenueRow[]> {
  const rows = await fetchAll((from, to) => ctx.supabase.from("v_event_revenue").select("*").gte("starts_at", fromIso).order("starts_at", { ascending: false }).range(from, to));
  return rows.map((r) => ({
    eventId: r.event_id ?? "", kind: r.kind ?? "", name: r.name ?? "", startsAt: r.starts_at ?? "", status: r.status ?? "", registrations: r.registrations ?? 0,
    invoiced: r.invoiced_cents ?? 0, paid: r.paid_cents ?? 0, outstanding: r.outstanding_cents ?? 0,
  }));
}

/** "YYYY-MM" `n` months before the month of `today`. */
export function monthsBack(today: string, n: number): string {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 - n, 1)).toISOString().slice(0, 7);
}

export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
