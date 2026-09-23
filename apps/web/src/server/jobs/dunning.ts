import { addDaysStr, DEFAULT_DUNNING, dueDunningSteps, type DunningStep } from "@koryo/billing";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { stripeFromEnv } from "@koryo/payments";
import { todayIn } from "@/lib/people";
import { AiError, billingRecovery } from "@koryo/ai";
import { chargeInvoiceWithCard } from "../billing/charge";
import { aiForJob } from "./ai";
import type { Job, JobStats } from "./types";

interface DunningState {
  failed_on?: string;
  stage?: number;
  attempts?: number;
  last_error?: string;
  next_step_on?: string | null;
  history?: { step: number; day: number; on: string; results: string[] }[];
}

/**
 * Daily dunning (F7.5). For each unpaid invoice in dunning — a failed autopay (dunning_state.failed_on) or
 * simply past due (enters on its due date) — runs the tenant's policy steps that have come due since it
 * failed: retry the card, queue payment_failed_N email/SMS with a pay/update-card link, and at the step
 * that says so suspend the membership (past_due → suspended). Steps run at most once (dunning_state.stage);
 * settling the invoice by any means ends dunning and restores the membership (trigger app.invoice_settled).
 */
export const dunning: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id, tenants(id, name, timezone, currency, stripe_account_id, stripe_onboarding_complete, settings)").eq("module_key", "billing").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const stripe = stripeFromEnv();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
  const stats: JobStats = { invoices: 0, steps: 0, notices: 0, retries: 0, recovered: 0, retry_skipped: 0, suspended: 0, ai_drafts: 0, ai_sent: 0 };
  const { data: intel } = await db.from("tenant_entitlements").select("tenant_id").eq("module_key", "intelligence").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  const intelligence = new Set((intel ?? []).map((x) => x.tenant_id));
  const ai = aiForJob(db);
  const bump = (k: string, n = 1) => (stats[k] = Number(stats[k] ?? 0) + n);

  for (const e of ents ?? []) {
    const t = e.tenants;
    if (!t) continue;
    const today = todayIn(t.timezone, now);
    const { data: policy } = await db.from("dunning_policies").select("steps").eq("tenant_id", t.id).eq("is_default", true).maybeSingle();
    // A8: AI-drafted follow-ups (Settings → AI): off | approve (drafts wait in Approvals) | auto (sent once the school has approved one).
    const aiMode = intelligence.has(t.id) ? ((t.settings as { ai?: { billing_recovery?: string } } | null)?.ai?.billing_recovery ?? "off") : "off";
    const { count: approvedBefore } = aiMode === "auto" ? await db.from("approval_items").select("id", { count: "exact", head: true }).eq("tenant_id", t.id).eq("kind", "billing_recovery").eq("status", "approved") : { count: 0 };
    const steps = ((policy?.steps as unknown as DunningStep[] | undefined)?.length ? policy?.steps : DEFAULT_DUNNING) as DunningStep[];

    const { data: invoices } = await db
      .from("invoices")
      .select("id, number, household_id, person_id, membership_id, balance_cents, due_at, status, dunning_state, households(primary_payer_person_id)")
      .eq("tenant_id", t.id)
      .in("status", ["open", "partially_paid", "past_due"])
      .gt("balance_cents", 0)
      .or(`dunning_state->>failed_on.not.is.null,status.eq.past_due`);
    for (const inv of invoices ?? []) {
      const state = (inv.dunning_state ?? {}) as DunningState;
      if ((state as { resolved_at?: string }).resolved_at) continue;
      const failedOn = state.failed_on ?? inv.due_at;
      const done = state.stage ?? 0;
      const due = dueDunningSteps(steps, failedOn, today, done);
      if (!due.length) continue;
      bump("invoices");
      if (inv.membership_id) await db.from("memberships").update({ status: "past_due" }).eq("id", inv.membership_id).eq("status", "active");

      const history = [...(state.history ?? [])];
      let stage = done;
      let lastError = state.last_error ?? "payment not received";
      let recovered = false;
      for (const idx of due) {
        const step = steps[idx];
        if (!step) continue;
        const results: string[] = [];
        const channels = step.actions.filter((a): a is "email" | "sms" => a === "email" || a === "sms");
        const person = inv.households?.primary_payer_person_id ?? inv.person_id;
        const data = { amount: formatMoney(inv.balance_cents, t.currency), invoice_number: String(inv.number), link: `${appUrl}/home/wallet?invoice=${inv.id}`, error: lastError };
        const template = async () => {
          const n = await db.rpc("dunning_notify", { p_tenant_id: t.id, p_template_key: `payment_failed_${Math.min(idx + 1, 3)}`, p_person_ids: [person as string], p_data: data, p_invoice_id: inv.id, p_channels: channels });
          bump("notices", n.data ?? 0);
          return n.data ?? 0;
        };
        if (channels.length && !person) results.push(`${channels.join("+")}: no recipient`);
        else if (channels.length && aiMode !== "off") {
          try {
            const { data: m } = inv.membership_id ? await db.from("memberships").select("starts_at").eq("id", inv.membership_id).maybeSingle() : { data: null };
            const { count: cards } = await db.from("payment_methods").select("id", { count: "exact", head: true }).eq("household_id", inv.household_id).eq("status", "active");
            const tenureMonths = m ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(m.starts_at)) / (30.44 * 86_400_000))) : 0;
            const r = await ai.runTask(billingRecovery, { school: t.name ?? "the school", stage: Math.min(idx + 1, 3), daysOverdue: Math.max(0, Math.round((Date.parse(today) - Date.parse(failedOn)) / 86_400_000)), tenureMonths, previousFailures: state.attempts ?? idx + 1, cardOnFile: (cards ?? 0) > 0 }, { tenantId: t.id });
            const fill = (x: string) => x.replaceAll("{{amount}}", data.amount).replaceAll("{{link}}", data.link);
            const messages = channels.map((c) => (c === "sms" ? { channel: "sms", body: fill(r.output.sms) } : { channel: "email", subject: fill(r.output.emailSubject), body: fill(r.output.emailBody) }));
            if (aiMode === "auto" && (approvedBefore ?? 0) > 0) {
              const body = [channels.includes("sms") ? fill(r.output.sms) : "", fill(r.output.emailBody)].join("\n---email---\n");
              const n = await db.rpc("queue_prerendered", { p_tenant_id: t.id, p_person_ids: [person as string], p_channels: channels, p_subject: fill(r.output.emailSubject), p_body: body, p_related_type: "invoice", p_related_id: inv.id });
              bump("ai_sent", n.data ?? 0);
              results.push(`AI follow-up sent automatically (${r.output.tone}${r.fixture ? ", dev fixture" : ""})`);
            } else {
              await db.from("approval_items").insert({
                tenant_id: t.id, kind: "billing_recovery", title: `Payment follow-up · invoice #${inv.number}`, person_id: person, ai_run_id: r.runId, entity_type: "invoice", entity_id: inv.id,
                preview: `${data.amount} overdue since ${failedOn} · step ${idx + 1} (${r.output.tone})${r.fixture ? " · dev fixture" : ""}. Last error: ${lastError}`,
                payload: { person_id: person, messages },
              });
              bump("ai_drafts");
              results.push(`AI draft (${r.output.tone}) waiting in Approvals`);
            }
          } catch (err) {
            if (!(err instanceof AiError)) throw err;
            const n = await template();
            results.push(`AI draft unavailable (${err.code.replace("_", " ")}) — standard notice queued (${n})`);
          }
        } else if (channels.length) {
          const n = await template();
          results.push(`${channels.join("+")} queued (${n})`);
        }
        for (const action of step.actions) {
          if (action === "retry") {
            if (!stripe || !t.stripe_account_id || !t.stripe_onboarding_complete) {
              bump("retry_skipped");
              results.push(`retry not attempted: ${!stripe ? "Stripe isn't configured on this server" : "Stripe account not connected"}`);
              continue;
            }
            bump("retries");
            try {
              const r = await chargeInvoiceWithCard(db, stripe, { tenantId: t.id, account: t.stripe_account_id, currency: t.currency }, inv.id, { attemptKey: `dunning:${idx}`, as: "service" });
              results.push(`retry ${r.status}${r.error ? `: ${r.error}` : ""}`);
              if (r.status === "succeeded" || r.status === "pending") {
                recovered = true;
                bump("recovered");
                break;
              }
              if (r.error) lastError = r.error;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              results.push(`retry error: ${message}`);
              lastError = message;
            }
          } else if (action === "suspend" && inv.membership_id) {
            const { data: s } = await db.from("memberships").update({ status: "suspended" }).eq("id", inv.membership_id).in("status", ["active", "past_due"]).select("id");
            if (s?.length) bump("suspended");
            results.push("membership suspended");
          }
        }
        stage = idx + 1;
        bump("steps");
        history.push({ step: idx + 1, day: step.day, on: today, results });
        if (recovered) break;
      }
      if (recovered) {
        log.info({ tenant_id: t.id, invoice: inv.id }, "dunning retry recovered the payment");
        continue; // invoice_settled trigger records the resolution
      }
      const next = steps[stage];
      await db.from("invoices").update({
        dunning_state: { ...state, failed_on: failedOn, stage, last_error: lastError, history, next_step_on: next ? addDaysStr(failedOn, next.day) : null },
      }).eq("id", inv.id);
    }
  }
  return stats;
};
