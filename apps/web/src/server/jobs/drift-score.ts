import { AiError, driftOutreach, scoreDrift, type DriftOutreachOutput } from "@koryo/ai";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import type { Json } from "@koryo/db/types";
import { todayIn } from "@/lib/people";
import { aiForJob } from "./ai";
import type { Job, JobStats } from "./types";

const TOP_N = 7;

/** Plain-template drafts, used when AI isn't available (every AI feature has a manual path). */
function templateDraft(school: string, first: string, level: string, details: string[]): DriftOutreachOutput {
  return {
    explanation: `${first} is at ${level} risk: ${details.join("; ")}.`,
    sms: `Hi {{first_name}}, we've missed {{student}} at class lately — is everything OK? Their spot is waiting whenever they're ready. Reply if a different class time would help. — ${school}`,
    emailSubject: "We miss {{student}}!",
    emailBody: `Hi {{first_name}},\n\nWe've noticed {{student}} hasn't been in class as much lately and wanted to check in. If schedules have changed, we're happy to help find a class time that works — just reply to this email.\n\nWe'd love to see {{student}} back on the mat.\n\n— ${school}`,
  };
}

/**
 * Nightly Drift Detector (A3): score every active student (rules in packages/ai/drift.ts); for the top
 * high-risk students without a recent outreach draft, explain and draft a check-in (AI, or a template when AI
 * isn't available) into Approvals. Nothing is sent until someone approves it.
 */
export const driftScore: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id, tenants(name, timezone, currency)").eq("module_key", "intelligence").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const ai = aiForJob(db);
  const stats: JobStats = { tenants: 0, scored: 0, high: 0, drafted: 0, ai_drafts: 0, template_drafts: 0 };
  const bump = (k: string, n = 1) => (stats[k] = Number(stats[k] ?? 0) + n);
  for (const e of ents ?? []) {
    const t = e.tenants;
    if (!t) continue;
    bump("tenants");
    const today = todayIn(t.timezone, now);
    const { data: feats, error: fErr } = await db.rpc("drift_features", { p_tenant: e.tenant_id, p_today: today });
    if (fErr) throw new Error(`drift_features: ${fErr.message}`);
    const scored = (feats ?? []).map((f) => ({
      f, s: scoreDrift({ recent4w: f.recent4w, prior8w: f.prior8w, daysSinceLast: f.days_since_last, pastDueCents: f.past_due_cents, tenureDays: f.tenure_days, concernNotes30d: f.concern_notes_30d }, (c) => formatMoney(c, t.currency)),
    }));
    for (let i = 0; i < scored.length; i += 500) {
      const { error: upErr } = await db.from("risk_scores").upsert(scored.slice(i, i + 500).map(({ f, s }) => ({
        tenant_id: e.tenant_id, person_id: f.person_id, computed_on: today, score: s.score, level: s.level,
        reasons: s.reasons as unknown as Json, features: { recent4w: f.recent4w, prior8w: f.prior8w, days_since_last: f.days_since_last, past_due_cents: f.past_due_cents, tenure_days: f.tenure_days, concern_notes_30d: f.concern_notes_30d },
      })), { onConflict: "person_id,computed_on" });
      if (upErr) throw new Error(`risk_scores: ${upErr.message}`);
    }
    bump("scored", scored.length);
    const high = scored.filter(({ s }) => s.level === "high").sort((a, b) => b.s.score - a.s.score);
    bump("high", high.length);
    const since = new Date(now.getTime() - 14 * 86_400_000).toISOString();
    const { data: recent } = high.length ? await db.from("approval_items").select("person_id").eq("tenant_id", e.tenant_id).eq("kind", "drift_outreach").or(`status.eq.pending,created_at.gte.${since}`) : { data: [] };
    const skip = new Set((recent ?? []).map((r) => r.person_id));
    for (const { f, s } of high.filter(({ f }) => !skip.has(f.person_id)).slice(0, TOP_N)) {
      let draft: DriftOutreachOutput;
      let runId: string | null = null;
      let viaAi = true;
      let note = "";
      try {
        const r = await ai.runTask(driftOutreach, { school: t.name, studentFirstName: f.first_name, minor: f.minor, level: s.level, reasons: s.reasons.map((x) => ({ factor: x.factor, detail: x.detail })) }, { tenantId: e.tenant_id });
        draft = r.output;
        runId = r.runId;
        if (r.fixture) note = " (dev fixture draft)";
      } catch (err) {
        if (!(err instanceof AiError)) throw err;
        draft = templateDraft(t.name, f.first_name, s.level, s.reasons.map((x) => x.detail));
        viaAi = false;
        note = ` (template draft — AI unavailable: ${err.code.replace("_", " ")})`;
      }
      const fill = (x: string) => x.replaceAll("{{student}}", f.first_name);
      const { data: item, error: aErr } = await db.from("approval_items").insert({
        tenant_id: e.tenant_id, kind: "drift_outreach", title: `${f.first_name} may be drifting away`, person_id: f.person_id, ai_run_id: runId,
        preview: `${draft.explanation}${note}\nRisk ${s.score}/100 · ${s.reasons.map((x) => x.detail).join(" · ")}`,
        payload: { person_id: f.person_id, messages: [{ channel: "sms", body: fill(draft.sms) }, { channel: "email", subject: fill(draft.emailSubject), body: fill(draft.emailBody) }] },
        entity_type: "risk_score", expires_at: new Date(now.getTime() + 21 * 86_400_000).toISOString(),
      }).select("id").single();
      if (aErr || !item) throw new Error(`approval_items: ${aErr?.message}`);
      await db.from("risk_scores").update({ explanation: draft.explanation, ai_run_id: runId, approval_item_id: item.id }).eq("person_id", f.person_id).eq("computed_on", today);
      bump("drafted");
      bump(viaAi ? "ai_drafts" : "template_drafts");
    }
    log.info({ tenant: e.tenant_id, scored: scored.length, high: high.length }, "drift scored");
  }
  return stats;
};
