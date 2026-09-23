import { AiError, leadNextAction, scoreLead } from "@koryo/ai";
import { aiForJob } from "./ai";
import type { Job, JobStats } from "./types";

/** Every 15 min (A10): score leads that are new or changed since their last score; AI suggests a next step. */
export const leadScoring: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id, tenants(name)").eq("module_key", "grow").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const { data: intel } = await db.from("tenant_entitlements").select("tenant_id").eq("module_key", "intelligence").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  const withAi = new Set((intel ?? []).map((x) => x.tenant_id));
  const ai = aiForJob(db);
  const stats: JobStats = { scored: 0, suggested: 0, suggestion_unavailable: 0 };
  // scored_at just after the row's own updated_at (set by trigger on this write), so the stamp itself doesn't re-queue it.
  const stamp = () => new Date(Date.now() + 1000).toISOString();
  for (const e of ents ?? []) {
    const { data: leads } = await db.from("leads").select("id, source, message, created_at, updated_at, scored_at, trial_booking_id, pipeline_stages(key, kind), lead_activities(kind, at)")
      .eq("tenant_id", e.tenant_id).order("updated_at", { ascending: false }).limit(1000);
    // PostgREST can't compare two columns, so "changed since scored" is decided here.
    const due = (leads ?? []).filter((l) => !l.scored_at || Date.parse(l.updated_at) > Date.parse(l.scored_at)).slice(0, 200);
    for (const l of due) {
      const stage = l.pipeline_stages?.key ?? "custom";
      if (l.pipeline_stages?.kind && l.pipeline_stages.kind !== "open") {
        await db.from("leads").update({ scored_at: stamp() }).eq("id", l.id);
        continue;
      }
      const acts = l.lead_activities ?? [];
      const last = acts.map((a) => Date.parse(a.at)).sort().at(-1);
      const signals = {
        stage, source: l.source, hasMessage: Boolean(l.message?.trim()), daysOld: Math.floor((now.getTime() - Date.parse(l.created_at)) / 86_400_000), activities: acts.length,
        trialBooked: Boolean(l.trial_booking_id) || acts.some((a) => a.kind === "trial_booked"), trialAttended: acts.some((a) => a.kind === "trial_attended"),
        lastTouchDays: last ? Math.floor((now.getTime() - last) / 86_400_000) : null,
      };
      const { score } = scoreLead(signals);
      let suggestion: string | null = null;
      if (withAi.has(e.tenant_id)) {
        try {
          const r = await ai.runTask(leadNextAction, { school: e.tenants?.name ?? "the school", stage, trialBooked: signals.trialBooked, trialAttended: signals.trialAttended, hasMessage: signals.hasMessage, lastTouchDays: signals.lastTouchDays, score }, { tenantId: e.tenant_id });
          suggestion = r.output.nextAction;
          stats.suggested = Number(stats.suggested) + 1;
        } catch (err) {
          if (!(err instanceof AiError)) throw err;
          stats.suggestion_unavailable = Number(stats.suggestion_unavailable) + 1;
        }
      }
      await db.from("leads").update({ score, ai_next_action: suggestion, scored_at: stamp() }).eq("id", l.id);
      stats.scored = Number(stats.scored) + 1;
    }
  }
  log.info(stats, "lead scoring");
  return stats;
};
