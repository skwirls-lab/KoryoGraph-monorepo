import "server-only";
import type { Ctx } from "../context";

export interface Scorable {
  registrationId: string;
  name: string;
  status: string;
  toRank: string | null;
  skills: { id: string; name: string; rubric: string }[];
  mine: { scores: Record<string, number>; result: string | null; comments: string | null } | null;
}

/** Students ready to score (paid/confirmed or already scored) with their rubric and this judge's sheet. */
export async function scoresheet(ctx: Ctx, eventId: string): Promise<Scorable[]> {
  const { data: regs } = await ctx.supabase
    .from("testing_registrations")
    .select("id, status, to_rank_id, people(first_name, last_name, preferred_name), ranks!testing_registrations_tenant_id_to_rank_id_fkey(name)")
    .eq("testing_event_id", eventId)
    .in("status", ["paid", "confirmed", "passed", "conditional", "failed"]);
  if (!regs?.length) return [];
  const rankIds = [...new Set(regs.map((r) => r.to_rank_id).filter((x): x is string => Boolean(x)))];
  const [{ data: rs }, { data: mine }] = await Promise.all([
    rankIds.length ? ctx.supabase.from("rank_skills").select("rank_id, skills(id, name, rubric)").in("rank_id", rankIds) : Promise.resolve({ data: [] }),
    ctx.supabase.from("testing_scores").select("registration_id, scores, result, comments").eq("judge_user_id", ctx.userId).in("registration_id", regs.map((r) => r.id)),
  ]);
  return regs.map((r) => ({
    registrationId: r.id,
    name: r.people ? `${r.people.preferred_name || r.people.first_name} ${r.people.last_name}`.trim() : "Student",
    status: r.status,
    toRank: r.ranks?.name ?? null,
    skills: (rs ?? []).filter((x) => x.rank_id === r.to_rank_id && x.skills).map((x) => ({
      id: x.skills?.id ?? "", name: x.skills?.name ?? "", rubric: Array.isArray(x.skills?.rubric) ? (x.skills.rubric as string[]).join(" · ") : "",
    })),
    mine: (() => {
      const m = (mine ?? []).find((s) => s.registration_id === r.id);
      return m ? { scores: (m.scores ?? {}) as Record<string, number>, result: m.result, comments: m.comments } : null;
    })(),
  })).sort((a, b) => a.name.localeCompare(b.name));
}
