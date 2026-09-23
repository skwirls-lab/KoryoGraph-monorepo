import { AiError, scheduleSuggestion } from "@koryo/ai";
import { addDaysStr } from "@koryo/billing";
import { todayIn } from "@/lib/people";
import { fillSuggestion, PLAIN, scheduleCandidates, type ClassStats } from "@/lib/schedule-suggestions";
import { aiForJob } from "./ai";
import type { Job, JobStats } from "./types";

/** Weekly (A12): the timetable's outliers from the last 4 weeks → up to 5 suggestions on the Desk dashboard. */
export const scheduleSuggestionsJob: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id, tenants(name, timezone)").eq("module_key", "intelligence").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const ai = aiForJob(db);
  const stats: JobStats = { tenants: 0, suggestions: 0, plain_wording: 0 };
  for (const e of ents ?? []) {
    const t = e.tenants;
    if (!t) continue;
    stats.tenants = Number(stats.tenants) + 1;
    const today = todayIn(t.timezone, now);
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    const weekOf = addDaysStr(today, -((dow + 6) % 7));
    const { data: rows, error: se } = await db.rpc("schedule_stats", { p_tenant_id: e.tenant_id, p_weeks: 4 });
    if (se) throw new Error(`schedule_stats: ${se.message}`);
    const candidates = scheduleCandidates((rows ?? []).map((r) => ({ ...r, capacity: r.capacity, avg_attended: Number(r.avg_attended), avg_booked: Number(r.avg_booked), avg_waitlisted: Number(r.avg_waitlisted), no_show_rate: Number(r.no_show_rate) }) as ClassStats));
    for (const c of candidates) {
      let words = PLAIN[c.kind];
      let runId: string | null = null;
      try {
        const r = await ai.runTask(scheduleSuggestion, {
          school: t.name, kind: c.kind, className: c.stats.name, weekday: c.stats.weekday, time: c.stats.start_time, utilization: c.utilization,
          waitlistPerSession: c.stats.avg_waitlisted, noShowRate: c.stats.no_show_rate, otherClass: c.other?.name ?? null,
        }, { tenantId: e.tenant_id });
        words = r.output;
        runId = r.runId;
      } catch (err) {
        if (!(err instanceof AiError)) throw err;
        stats.plain_wording = Number(stats.plain_wording) + 1;
      }
      const { error: ie } = await db.from("schedule_suggestions").upsert({
        tenant_id: e.tenant_id, week_of: weekOf, kind: c.kind, template_id: c.stats.template_id,
        title: fillSuggestion(words.title, c), rationale: fillSuggestion(words.rationale, c), ai_run_id: runId,
        stats: { utilization: Math.round(c.utilization * 100) / 100, sessions: c.stats.sessions, capacity: c.stats.capacity, avg_attended: c.stats.avg_attended, avg_waitlisted: c.stats.avg_waitlisted, no_show_rate: c.stats.no_show_rate, other_template_id: c.other?.template_id ?? null },
      }, { onConflict: "tenant_id,week_of,kind,template_id", ignoreDuplicates: true });
      if (ie) throw new Error(`schedule_suggestions: ${ie.message}`);
      stats.suggestions = Number(stats.suggestions) + 1;
    }
    log.info({ tenant: e.tenant_id, candidates: candidates.length }, "schedule suggestions");
  }
  return stats;
};
