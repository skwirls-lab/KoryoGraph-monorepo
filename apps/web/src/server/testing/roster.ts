import "server-only";
import type { EligibilityResult } from "@koryo/eligibility";
import type { Ctx } from "../context";
import { getProgress } from "../queries/progress";

export interface RosterCandidate {
  enrollmentId: string;
  personId: string;
  name: string;
  programName: string;
  currentRank: string | null;
  nextRank: { id: string; name: string } | null;
  eligibility: EligibilityResult;
  skillNames: Map<string, string>;
  registration: { id: string; status: string } | null;
}

/**
 * The auto-roster for a testing event: every active enrollment in the event's programs, run through the
 * eligibility engine (same numbers the Progress tab shows), with any existing registration attached.
 */
export async function testingRoster(ctx: Ctx, event: { id: string; program_ids: string[] }): Promise<RosterCandidate[]> {
  const [{ data: enrollments }, { data: regs }] = await Promise.all([
    ctx.supabase.from("enrollments").select("id, person_id, people(first_name, last_name, preferred_name)").in("program_id", event.program_ids).eq("status", "active"),
    ctx.supabase.from("testing_registrations").select("id, enrollment_id, status").eq("testing_event_id", event.id),
  ]);
  if (!enrollments?.length) return [];
  const regBy = new Map((regs ?? []).map((r) => [r.enrollment_id, { id: r.id, status: r.status }]));
  const nameBy = new Map(enrollments.map((e) => [e.id, e.people ? `${e.people.preferred_name || e.people.first_name} ${e.people.last_name}`.trim() : "Student"]));
  const progress = [];
  for (let i = 0; i < enrollments.length; i += 150) {
    progress.push(...(await getProgress(ctx, { enrollmentIds: enrollments.slice(i, i + 150).map((e) => e.id) })));
  }
  return progress
    .map((p) => ({
      enrollmentId: p.enrollmentId,
      personId: p.personId,
      name: nameBy.get(p.enrollmentId) ?? "Student",
      programName: p.programName,
      currentRank: p.current?.name ?? null,
      nextRank: p.next ? { id: p.next.id, name: p.next.name } : null,
      eligibility: p.eligibility,
      skillNames: new Map(p.skills.map((s) => [s.id, s.name])),
      registration: regBy.get(p.enrollmentId) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
