import { readFileSync } from "node:fs";
import path from "node:path";
import { createStripe, signTestPayload, type Stripe } from "@koryo/payments";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { processStripeEvent } from "@/server/admin/stripe/events";
import { sid } from "../../scripts/lib/ids";
import { admin, asClaims, seededClaims, sql } from "./harness";

// Handler tests: fixture events (tests/fixtures/stripe) applied through the same code the webhook route uses.
const R = sid("tenant:ridgeline");
const ADAMS = sid("household:ridgeline:adams");
const COOPER = sid("household:ridgeline:cooper");
const ACCOUNT = "acct_fixture_ridgeline";
let invoiceId = "";

function fixture(name: string, overrides: { id?: string; object?: Record<string, unknown> } = {}): Stripe.Event {
  const raw = readFileSync(path.resolve(import.meta.dirname, "../fixtures/stripe", `${name}.json`), "utf8")
    .replaceAll("__ACCOUNT__", ACCOUNT).replaceAll("__TENANT__", R).replaceAll("__HOUSEHOLD__", ADAMS)
    .replaceAll("__HOUSEHOLD_COOPER__", COOPER).replaceAll("__INVOICE__", invoiceId);
  const event = JSON.parse(raw) as Stripe.Event & { data: { object: Record<string, unknown> } };
  if (overrides.id) event.id = overrides.id;
  if (overrides.object) Object.assign(event.data.object, overrides.object);
  return event;
}
const apply = (e: Stripe.Event) => processStripeEvent(admin, e, { stripe: null });

async function payment(pi: string) {
  const [p] = await sql<{ id: string; status: string; amount_cents: number; refunded_cents: number; failure_code: string | null; payment_method_id: string | null }[]>`
    select id, status, amount_cents, refunded_cents, failure_code, payment_method_id from public.payments where tenant_id = ${R} and stripe_payment_intent_id = ${pi}`;
  return p;
}
const invoice = async () => (await sql<{ status: string; paid_cents: number; balance_cents: number }[]>`select status, paid_cents, balance_cents from public.invoices where id = ${invoiceId}`)[0];
const unappliedCredit = async (paymentId: string) =>
  (await sql<{ s: number }[]>`select coalesce(sum(remaining_cents), 0)::int as s from public.credits where source_ref = ${`payment:${paymentId}`}`)[0]?.s;

async function cleanup() {
  await sql`delete from public.stripe_events where id like 'evt_fixture_%'`;
  await sql`delete from public.payments where tenant_id = ${R} and stripe_payment_intent_id like 'pi_fixture_%'`;
  await sql`delete from public.payment_methods where tenant_id = ${R} and stripe_payment_method_id like 'pm_fixture_%'`;
  await sql`delete from public.credits where tenant_id = ${R} and reason = 'Unapplied payment' and household_id = ${ADAMS}`;
  if (invoiceId) await sql`delete from public.invoices where id = ${invoiceId}`;
  await sql`update public.households set stripe_customer_id = null where id in (${ADAMS}, ${COOPER})`;
  await sql`update public.tenants set stripe_account_id = null, stripe_onboarding_complete = false where id = ${R}`;
}

beforeAll(async () => {
  await cleanup();
  await sql`update public.tenants set stripe_account_id = ${ACCOUNT} where id = ${R}`;
  await sql`update public.households set stripe_customer_id = 'cus_fixture_adams' where id = ${ADAMS}`;
  const [n] = await sql<{ n: string }[]>`select app.next_counter(${R}, 'invoice') as n`;
  const due = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  const [inv] = await sql<{ id: string }[]>`insert into public.invoices (tenant_id, household_id, number, subtotal_cents, total_cents, due_at)
    values (${R}, ${ADAMS}, ${n?.n ?? 0}, 10000, 10000, ${due}) returning id`;
  invoiceId = inv?.id ?? "";
});

afterAll(async () => {
  await cleanup();
  await sql.end();
});

describe("payment methods", () => {
  it("setup_intent.succeeded vaults the card as the household default", async () => {
    expect((await apply(fixture("setup_intent.succeeded"))).outcome).toBe("processed");
    const rows = await sql<{ brand: string; last4: string; is_default: boolean; status: string }[]>`
      select brand, last4, is_default, status from public.payment_methods where stripe_payment_method_id = 'pm_fixture_visa'`;
    expect(rows).toEqual([{ brand: "visa", last4: "4242", is_default: true, status: "active" }]);
  });

  it("payment_method.attached adds a second card (not default); detached marks it detached", async () => {
    await apply(fixture("payment_method.attached"));
    await apply(fixture("payment_method.detached"));
    const [mc] = await sql<{ is_default: boolean; status: string }[]>`select is_default, status from public.payment_methods where stripe_payment_method_id = 'pm_fixture_mc'`;
    expect(mc).toEqual({ is_default: false, status: "detached" });
  });
});

describe("payment intents", () => {
  it("payment_intent.succeeded records the payment, pays the invoice and keeps the overpayment as credit", async () => {
    expect((await apply(fixture("payment_intent.succeeded"))).outcome).toBe("processed");
    const p = await payment("pi_fixture_invoice");
    expect(p).toMatchObject({ status: "succeeded", amount_cents: 12000 });
    expect(p?.payment_method_id).not.toBeNull();
    expect(await invoice()).toEqual({ status: "paid", paid_cents: 10000, balance_cents: 0 });
    expect(await unappliedCredit(p?.id ?? "")).toBe(2000);
  });

  it("is idempotent: the same event, and a second event for the same intent, change nothing", async () => {
    expect((await apply(fixture("payment_intent.succeeded"))).outcome).toBe("duplicate");
    expect((await apply(fixture("payment_intent.succeeded", { id: "evt_fixture_pi_succeeded_again" }))).outcome).toBe("processed");
    const p = await payment("pi_fixture_invoice");
    const [alloc] = await sql<{ n: number; s: number }[]>`select count(*)::int as n, sum(amount_cents)::int as s from public.payment_allocations where payment_id = ${p?.id ?? ""}`;
    expect(alloc).toEqual({ n: 1, s: 10000 });
    expect(await unappliedCredit(p?.id ?? "")).toBe(2000);
  });

  it("a declined card creates a failed payment row with the decline code", async () => {
    await apply(fixture("payment_intent.payment_failed"));
    expect(await payment("pi_fixture_decline")).toMatchObject({ status: "failed", failure_code: "generic_decline", amount_cents: 100 });
  });

  it("a later success on the same intent settles it; a stale failure never regresses it", async () => {
    await apply(fixture("payment_intent.succeeded.retry"));
    expect(await payment("pi_fixture_decline")).toMatchObject({ status: "succeeded", failure_code: null });
    await apply(fixture("payment_intent.payment_failed", { id: "evt_fixture_pi_failed_late" }));
    expect((await payment("pi_fixture_decline"))?.status).toBe("succeeded");
  });

  it("ignores intents that aren't KoryoGraph's", async () => {
    const e = fixture("payment_intent.succeeded", { id: "evt_fixture_foreign", object: { id: "pi_fixture_foreign", customer: "cus_other", metadata: {} } });
    expect((await apply(e)).detail).toMatch(/not a KoryoGraph payment/);
    expect(await payment("pi_fixture_foreign")).toBeUndefined();
  });
});

describe("refunds", () => {
  it("charge.refunded reverses unapplied credit first, then the invoice allocation", async () => {
    await apply(fixture("charge.refunded"));
    const p = await payment("pi_fixture_invoice");
    expect(p).toMatchObject({ status: "partially_refunded", refunded_cents: 5000 });
    expect(await unappliedCredit(p?.id ?? "")).toBe(0);
    expect(await invoice()).toMatchObject({ status: "partially_paid", paid_cents: 7000, balance_cents: 3000 });
  });

  it("a refund already recorded in KoryoGraph is not duplicated when Stripe reports it", async () => {
    const p = await payment("pi_fixture_invoice");
    await sql`select app.apply_refund(${R}, ${p?.id ?? ""}, 2000, 'Parent request', 're_fixture_1', null)`;
    await apply(fixture("charge.refunded", { id: "evt_fixture_charge_refunded_2", object: { amount_refunded: 7000 } }));
    const [r] = await sql<{ n: number; s: number }[]>`select count(*)::int as n, sum(amount_cents)::int as s from public.refunds where payment_id = ${p?.id ?? ""}`;
    expect(r).toEqual({ n: 2, s: 7000 });
    expect((await payment("pi_fixture_invoice"))?.refunded_cents).toBe(7000);
  });

  it("refuses to refund more than was paid", async () => {
    const p = await payment("pi_fixture_invoice");
    await expect(sql`select app.apply_refund(${R}, ${p?.id ?? ""}, 6000, 'too much', null, null)`).rejects.toMatchObject({ code: "22023" });
  });
});

describe("customers and accounts", () => {
  it("customer.created links the household named in metadata; customer.deleted unlinks it", async () => {
    await apply(fixture("customer.created"));
    expect((await sql`select stripe_customer_id from public.households where id = ${COOPER}`)[0]?.stripe_customer_id).toBe("cus_fixture_cooper");
    await apply(fixture("customer.deleted"));
    expect((await sql`select stripe_customer_id from public.households where id = ${COOPER}`)[0]?.stripe_customer_id).toBeNull();
  });

  it("account.updated marks Connect onboarding complete", async () => {
    await apply(fixture("account.updated"));
    expect((await sql`select stripe_onboarding_complete from public.tenants where id = ${R}`)[0]?.stripe_onboarding_complete).toBe(true);
  });

  it("events for an unknown account, or of an unhandled type, are acknowledged and ignored", async () => {
    const other = { ...fixture("account.updated", { id: "evt_fixture_unknown_acct" }), account: "acct_unknown" } as Stripe.Event;
    (other.data.object as { id: string }).id = "acct_unknown";
    expect((await apply(other)).outcome).toBe("ignored");
    const unhandled = { ...fixture("customer.created", { id: "evt_fixture_unhandled" }), type: "invoice.created" } as unknown as Stripe.Event;
    expect((await apply(unhandled)).outcome).toBe("ignored");
  });
});

describe("RPC permissions", () => {
  it("Home members can't record payments; a core-only tenant can't use billing RPCs", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.record_payment_intent('{}'::jsonb)`)).rejects.toMatchObject({ code: "42501" });
    await expect(asClaims(parent, (tx) => tx`select public.record_refund(gen_random_uuid(), 100, 'x')`)).rejects.toMatchObject({ code: "42501" });
    const harbor = await seededClaims("owner@harborbjj.demo");
    await expect(asClaims(harbor, (tx) => tx`select public.set_household_stripe_customer(gen_random_uuid(), 'cus_x')`)).rejects.toMatchObject({ code: "42501" });
  });

  it("a Home member can vault a card only for their own household's customer", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await sql`update public.households set stripe_customer_id = 'cus_fixture_cooper' where id = ${COOPER}`;
    const pm = { id: "pm_fixture_home", type: "card", customer: "cus_fixture_cooper", card: { brand: "visa", last4: "1881", exp_month: 1, exp_year: 2031 } };
    const [row] = await asClaims(parent, (tx) => tx<{ id: string }[]>`select public.record_payment_method(${COOPER}, ${sql.json(pm)}) as id`);
    expect(row?.id).toBeTruthy();
    await expect(asClaims(parent, (tx) => tx`select public.record_payment_method(${ADAMS}, ${sql.json({ ...pm, customer: "cus_fixture_adams" })})`)).rejects.toMatchObject({ code: "42501" });
    await expect(asClaims(parent, (tx) => tx`select public.record_payment_method(${COOPER}, ${sql.json({ ...pm, customer: "cus_someone_else" })})`)).rejects.toMatchObject({ code: "42501" });
    await sql`update public.households set stripe_customer_id = null where id = ${COOPER}`;
  });

  it("the service-role RPCs are not callable by signed-in users", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    await expect(asClaims(owner, (tx) => tx`select public.record_payment_intent_for(${R}, '{}'::jsonb)`)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("webhook route", () => {
  const secret = "whsec_fixture";
  const signer = createStripe({ mock: true });
  const post = async (body: string, sig: string | null) => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    return POST(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body, headers: sig ? { "stripe-signature": sig } : {} }));
  };

  it("503 when not configured, 400 on a bad signature, 200 on a signed event", async () => {
    const saved = { s: process.env.STRIPE_WEBHOOK_SECRET, m: process.env.STRIPE_MOCK };
    try {
      process.env.STRIPE_WEBHOOK_SECRET = "";
      const body = JSON.stringify(fixture("account.updated", { id: "evt_fixture_route" }));
      expect((await post(body, "t=1,v1=x")).status).toBe(503);
      process.env.STRIPE_WEBHOOK_SECRET = secret;
      process.env.STRIPE_MOCK = "1";
      expect((await post(body, "t=1,v1=bad")).status).toBe(400);
      const ok = await post(body, signTestPayload(signer, body, secret));
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ received: true, outcome: "processed" });
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = saved.s;
      process.env.STRIPE_MOCK = saved.m;
    }
  });
});
