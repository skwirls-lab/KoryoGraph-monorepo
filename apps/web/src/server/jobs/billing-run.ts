import { advancePeriod, addDaysStr, computeInvoice, familyDiscountPct, freezeProration, toUtc, type Interval } from "@koryo/billing";
import { rpc } from "@koryo/db";
import type { Json } from "@koryo/db/types";
import { chargeCard, feeBpsFromEnv, stripeFromEnv } from "@koryo/payments";
import { todayIn } from "@/lib/people";
import type { Job, JobStats } from "./types";

const LIVE = ["active", "trial", "past_due", "on_hold"];
const MAX_PERIODS = 12; // catch-up bound for a membership whose next_bill_at is far in the past

interface DueMembership {
  id: string;
  household_id: string;
  person_id: string;
  status: string;
  next_bill_at: string;
  price_override_cents: number | null;
  hold_from: string | null;
  hold_until: string | null;
  cancel_at: string | null;
  autopay: boolean;
  payment_method_id: string | null;
  membership_plans: { name: string; kind: string; interval: Interval | null; interval_count: number; price_cents: number; family_discount: { second_pct?: number; third_plus_pct?: number }; tax_class: string } | null;
}

/**
 * Daily billing run (F7.4). Per tenant with Billing: date-driven membership transitions, then one invoice
 * per due (membership, period) — family discount by rank within the household, holds prorated, tax by
 * class — created atomically with the next_bill_at advance (unique per period, so re-runs are no-ops),
 * then autopay attempts through Stripe when it is configured. `params.now` (via the job route, non-prod)
 * pins "today".
 */
export const billingRun: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id, tenants(id, timezone, currency, stripe_account_id, stripe_onboarding_complete)").eq("module_key", "billing").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const tenants = new Map((ents ?? []).flatMap((e) => (e.tenants ? [[e.tenant_id, e.tenants] as const] : [])));

  const stripe = stripeFromEnv();
  const stats: JobStats = { tenants: tenants.size, invoices: 0, amount_cents: 0, charges_attempted: 0, charges_succeeded: 0, charges_failed: 0, autopay_skipped: 0, past_due: 0 };
  const bump = (k: string, n = 1) => (stats[k] = Number(stats[k] ?? 0) + n);

  for (const [tid, t] of tenants) {
    const today = todayIn(t.timezone, now);
    const errors: string[] = [];
    const { data: run } = await db.from("billing_runs").insert({ tenant_id: tid, run_date: today, status: "running" }).select("id").single();
    let created = 0;
    let amount = 0;
    let attempted = 0;
    try {
      const lifecycle = (await rpc(db, "billing_lifecycle", { p_tenant_id: tid, p_today: today })) as Record<string, number>;
      bump("past_due", lifecycle.past_due ?? 0);

      const { data: rates } = await db.from("tax_rates").select("rate, applies_to").eq("tenant_id", tid);
      const taxRates: Record<string, number> = {};
      for (const r of rates ?? []) for (const c of r.applies_to) taxRates[c] = (taxRates[c] ?? 0) + Number(r.rate);

      const { data: dueRows, error: dueErr } = await db
        .from("memberships")
        .select("id, household_id, person_id, status, next_bill_at, price_override_cents, hold_from, hold_until, cancel_at, autopay, payment_method_id, membership_plans(name, kind, interval, interval_count, price_cents, family_discount, tax_class)")
        .eq("tenant_id", tid)
        .in("status", ["active", "past_due", "on_hold"])
        .not("next_bill_at", "is", null)
        .lte("next_bill_at", today);
      if (dueErr) throw new Error(`memberships: ${dueErr.message}`);
      const due = (dueRows ?? []) as unknown as DueMembership[];
      if (!due.length) {
        await db.from("billing_runs").update({ status: "ok" }).eq("id", run?.id ?? "");
        continue;
      }

      // Household ranking for family discounts uses every live membership at its full price.
      const householdIds = [...new Set(due.map((m) => m.household_id))];
      const { data: live } = await db.from("memberships").select("id, household_id, price_override_cents, membership_plans(price_cents)").in("household_id", householdIds).in("status", LIVE);
      const byHousehold = new Map<string, { id: string; priceCents: number }[]>();
      for (const m of live ?? []) {
        const list = byHousehold.get(m.household_id) ?? [];
        list.push({ id: m.id, priceCents: m.price_override_cents ?? m.membership_plans?.price_cents ?? 0 });
        byHousehold.set(m.household_id, list);
      }

      const toCharge: { invoiceId: string; m: DueMembership; total: number }[] = [];
      for (const m of due) {
        const plan = m.membership_plans;
        if (!plan || !plan.interval || !["recurring", "contract"].includes(plan.kind)) continue;
        const price = m.price_override_cents ?? plan.price_cents;
        const rule = { secondPct: plan.family_discount.second_pct ?? 0, thirdPlusPct: plan.family_discount.third_plus_pct ?? 0 };
        const pct = familyDiscountPct(byHousehold.get(m.household_id) ?? [], m.id, rule);
        let periodStart = m.next_bill_at;
        for (let i = 0; i < MAX_PERIODS && toUtc(periodStart) <= toUtc(today); i++) {
          if (m.cancel_at && toUtc(m.cancel_at) <= toUtc(periodStart)) break;
          const periodEnd = advancePeriod(periodStart, plan.interval, plan.interval_count);
          const held = m.hold_from ? freezeProration(price, periodStart, periodEnd, m.hold_from, m.hold_until ?? periodEnd) : price;
          const lastDay = addDaysStr(periodEnd, -1);
          const invoice = computeInvoice(
            [{ kind: "membership", description: `${plan.name} (${periodStart} – ${lastDay})${held !== price ? " · on hold part of the period" : ""}${pct ? ` · family discount ${pct}%` : ""}`, unitCents: held, taxClass: plan.tax_class, lineDiscountCents: Math.round((held * pct) / 100) }],
            [],
            taxRates,
          );
          const invoiceId = await rpc(db, "billing_run_invoice", {
            p_tenant_id: tid,
            p: {
              membership_id: m.id, household_id: m.household_id, person_id: m.person_id, period_start: periodStart, period_end: periodEnd, next_bill_at: periodEnd,
              due_at: periodStart, subtotal_cents: invoice.subtotalCents, discount_cents: invoice.discountCents, tax_cents: invoice.taxCents, total_cents: invoice.totalCents,
              lines: invoice.lines.map((l) => ({ kind: l.kind, description: l.description, quantity: l.quantity, unit_cents: l.unitCents, total_cents: l.totalCents, tax_rate: l.taxRate || null })),
            } as unknown as Json,
          });
          if (invoiceId) {
            created++;
            amount += invoice.totalCents;
            if (m.autopay && m.payment_method_id && invoice.totalCents > 0) toCharge.push({ invoiceId, m, total: invoice.totalCents });
          }
          periodStart = periodEnd;
        }
      }

      // Autopay: only with Stripe configured and the school connected — otherwise say so in the run.
      if (toCharge.length && (!stripe || !t.stripe_account_id || !t.stripe_onboarding_complete)) {
        bump("autopay_skipped", toCharge.length);
        errors.push(`${toCharge.length} autopay charge(s) not attempted: ${!stripe ? "Stripe isn't configured on this server" : "the school's Stripe account isn't connected"}`);
      } else if (stripe && t.stripe_account_id) {
        for (const c of toCharge) {
          attempted++;
          const [{ data: pm }, { data: h }] = await Promise.all([
            db.from("payment_methods").select("stripe_payment_method_id, status").eq("id", c.m.payment_method_id ?? "").maybeSingle(),
            db.from("households").select("stripe_customer_id").eq("id", c.m.household_id).maybeSingle(),
          ]);
          if (!pm || pm.status !== "active" || !h?.stripe_customer_id) {
            bump("charges_failed");
            await db.from("invoices").update({ dunning_state: { attempts: 1, failed_on: today, stage: 0, last_error: "No usable card on file" } }).eq("id", c.invoiceId);
            continue;
          }
          try {
            const pi = await chargeCard(stripe, t.stripe_account_id, {
              tenantId: tid, householdId: c.m.household_id, customerId: h.stripe_customer_id, amountCents: c.total, currency: t.currency,
              paymentMethodId: pm.stripe_payment_method_id, offSession: true, invoiceId: c.invoiceId, attemptKey: `run:${today}`, description: "Membership", feeBps: feeBpsFromEnv(),
            });
            await rpc(db, "record_payment_intent_for", { p_tenant_id: tid, p_pi: pi as unknown as Json });
            if (pi.status === "succeeded" || pi.status === "processing") bump("charges_succeeded");
            else {
              bump("charges_failed");
              await db.from("invoices").update({ dunning_state: { attempts: 1, failed_on: today, stage: 0, last_error: pi.last_payment_error?.message ?? "declined" } }).eq("id", c.invoiceId);
            }
          } catch (err) {
            bump("charges_failed");
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`charge for invoice ${c.invoiceId}: ${message}`);
            await db.from("invoices").update({ dunning_state: { attempts: 1, failed_on: today, stage: 0, last_error: message } }).eq("id", c.invoiceId);
          }
        }
      }
      await db.from("billing_runs").update({ status: "ok", invoices_created: created, amount_cents: amount, charges_attempted: attempted, errors }).eq("id", run?.id ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ tenant_id: tid, err: message }, "billing run failed for tenant");
      await db.from("billing_runs").update({ status: "error", invoices_created: created, amount_cents: amount, charges_attempted: attempted, errors: [...errors, message] }).eq("id", run?.id ?? "");
      throw err;
    }
    bump("invoices", created);
    bump("amount_cents", amount);
    bump("charges_attempted", attempted);
  }
  return stats;
};
