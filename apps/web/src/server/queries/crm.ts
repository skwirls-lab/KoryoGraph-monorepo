import "server-only";
import { todayIn } from "@/lib/people";
import type { BoardLead, BoardStage, TrialSession } from "@/components/crm/pipeline-board";
import type { Ctx } from "../context";

export async function pipeline(ctx: Ctx): Promise<{ stages: BoardStage[]; leads: BoardLead[]; sessions: TrialSession[] }> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: stages }, { data: leads }, { data: programs }, { data: sessions }] = await Promise.all([
    ctx.supabase.from("pipeline_stages").select("id, key, name, kind, position").order("position"),
    ctx.supabase.from("leads").select("id, stage_id, source, program_interest, next_action, next_action_at, score, ai_next_action, lost_reason, converted_household_id, stage_changed_at, people(first_name, last_name, preferred_name), bookings(status, class_sessions(name, starts_at))").order("created_at", { ascending: false }).limit(500),
    ctx.supabase.from("programs").select("id, name"),
    ctx.supabase.from("class_sessions").select("id, name, starts_at").eq("status", "scheduled").eq("bookable", true).gt("starts_at", new Date().toISOString()).lt("starts_at", new Date(Date.now() + 14 * 86_400_000).toISOString()).order("starts_at").limit(100),
  ]);
  const programName = new Map((programs ?? []).map((p) => [p.id, p.name]));
  const closedKinds = new Map((stages ?? []).map((s) => [s.id, s.kind]));
  const today = todayIn(ctx.tz);
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: ctx.tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return {
    stages: (stages ?? []).map((s) => ({ id: s.id, key: s.key, name: s.name, kind: s.kind })),
    leads: (leads ?? [])
      .filter((l) => closedKinds.get(l.stage_id) === "open" || l.stage_changed_at >= since)
      .map((l) => ({
        id: l.id, stageId: l.stage_id,
        name: l.people ? `${l.people.preferred_name || l.people.first_name} ${l.people.last_name}`.trim() : "Lead",
        source: l.source, interest: l.program_interest.map((p) => programName.get(p) ?? "").filter(Boolean),
        nextAction: l.next_action, score: l.score, aiNextAction: l.ai_next_action, nextActionDue: l.next_action_at ? l.next_action_at.slice(0, 10) : null,
        overdue: Boolean(l.next_action_at && l.next_action_at.slice(0, 10) < today),
        trial: l.bookings?.class_sessions ? `${l.bookings.class_sessions.name}, ${fmt(l.bookings.class_sessions.starts_at)}${l.bookings.status === "attended" ? " ✓" : ""}` : null,
        lostReason: l.lost_reason,
      })),
    sessions: (sessions ?? []).map((s) => ({ id: s.id, label: `${fmt(s.starts_at)} — ${s.name}` })),
  };
}
