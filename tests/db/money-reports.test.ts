import { randomUUID } from "node:crypto";
import { addMonthsStr, computeInvoice, deferredRevenue, monthlyEquivalent } from "@koryo/billing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

// Report views vs the billing engine, on fixtures in their own household (M2.10 acceptance).
const R = sid("tenant:ridgeline");
const household = randomUUID();
const kid = randomUUID();
const plans = { monthly: randomUUID(), weekly: randomUUID(), yearly: randomUUID(), pif: randomUUID() };
const ms = { monthly: randomUUID(), weekly: randomUUID(), yearly: randomUUID(), pif: randomUUID() };
let today = "";
let owner: Record<string, unknown>;
type MrrRow = { month: string; mrr_cents: number; new_mrr_cents: number; churned_mrr_cents: number };
let before: MrrRow[] = [];
const mrr = () => asClaims(owner, (tx) => tx<MrrRow[]>`select month::text, mrr_cents, new_mrr_cents, churned_mrr_cents from public.v_mrr_monthly order by month`);

async function invoice(lines: Parameters<typeof computeInvoice>[0], membership: string | null, issued: string) {
  const c = computeInvoice(lines, [], { retail: 0.053 });
  const [n] = await sql<{ n: string }[]>`select app.next_counter(${R}, 'invoice') as n`;
  const [i] = await sql<{ id: string }[]>`insert into public.invoices (tenant_id, household_id, person_id, membership_id, number, subtotal_cents, discount_cents, tax_cents, total_cents, due_at, issued_at, source)
    values (${R}, ${household}, ${kid}, ${membership}, ${n?.n ?? 0}, ${c.subtotalCents}, ${c.discountCents}, ${c.taxCents}, ${c.totalCents}, ${issued}, ${`${issued}T15:00:00Z`}, 'manual') returning id`;
  for (const l of c.lines) {
    await sql`insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, tax_cents, tax_rate)
      values (${R}, ${i?.id ?? ""}, ${l.kind}, ${l.description}, ${l.quantity}, ${l.unitCents}, ${l.totalCents}, ${l.taxCents}, ${l.taxRate || null})`;
  }
  return { id: i?.id ?? "", computed: c };
}

beforeAll(async () => {
  owner = await seededClaims("owner@ridgelinetkd.demo");
  today = (await sql<{ d: string }[]>`select app.tenant_today(${R})::text as d`)[0]?.d ?? "";
  before = await mrr();
  await sql`insert into public.households (id, tenant_id, name) values (${household}, ${R}, 'Money report fixtures')`;
  await sql`insert into public.people (id, tenant_id, first_name, last_name, type_flags) values (${kid}, ${R}, 'Mo', 'Ney', ${["student"]})`;
  await sql`insert into public.household_members (tenant_id, household_id, person_id, relationship) values (${R}, ${household}, ${kid}, 'student')`;
  const plan = (id: string, name: string, kind: string, interval: string | null, price: number, extra: Record<string, number | null> = {}) =>
    sql`insert into public.membership_plans (id, tenant_id, name, kind, interval, price_cents, term_months, active) values (${id}, ${R}, ${name}, ${kind}, ${interval}, ${price}, ${extra.term ?? null}, false)`;
  await plan(plans.monthly, "MR monthly", "recurring", "month", 16900);
  await plan(plans.weekly, "MR weekly", "recurring", "week", 4500);
  await plan(plans.yearly, "MR yearly", "recurring", "year", 120000);
  await plan(plans.pif, "MR six months", "paid_in_full", null, 89900, { term: 6 });
  const thisMonth = `${today.slice(0, 7)}-01`;
  const mem = (id: string, planId: string, status: string, start: string, cancelAt: string | null = null) =>
    sql`insert into public.memberships (id, tenant_id, household_id, person_id, plan_id, status, starts_at, cancel_at) values (${id}, ${R}, ${household}, ${kid}, ${planId}, ${status}, ${start}, ${cancelAt})`;
  await mem(ms.monthly, plans.monthly, "active", addMonthsStr(thisMonth, -2));
  await mem(ms.weekly, plans.weekly, "active", thisMonth);
  await mem(ms.yearly, plans.yearly, "cancelled", addMonthsStr(thisMonth, -6), addMonthsStr(thisMonth, -1));
  await mem(ms.pif, plans.pif, "active", addMonthsStr(today, -2));
});

afterAll(async () => {
  await sql`delete from public.payments where household_id = ${household}`;
  await sql`delete from public.invoices where household_id = ${household}`;
  await sql`delete from public.memberships where household_id = ${household}`;
  await sql`delete from public.membership_plans where id = any(${Object.values(plans)})`;
  await sql`delete from public.households where id = ${household}`;
  await sql`delete from public.people where id = ${kid}`;
  await sql.end();
});

describe("money report views match the billing engine", () => {
  it("revenue by GL class = engine net of tax", async () => {
    const a = await invoice([
      { kind: "membership", description: "Monthly", unitCents: 16900, lineDiscountCents: 1690 },
      { kind: "fee", description: "Enrollment fee", unitCents: 4900, discountable: false },
    ], ms.monthly, today);
    const b = await invoice([
      { kind: "product", description: "Belt", unitCents: 1000, quantity: 3, taxClass: "retail", lineDiscountCents: 150, discountable: true },
      { kind: "adjustment", description: "Goodwill", unitCents: -500 },
    ], null, today);
    const rows = await asClaims(owner, (tx) => tx<{ gl_class: string; net: number; tax: number }[]>`
      select gl_class, sum(net_cents)::int as net, sum(tax_cents)::int as tax from public.v_revenue_lines where household_id = ${household} group by gl_class`);
    const got = Object.fromEntries(rows.map((r) => [r.gl_class, { net: r.net, tax: r.tax }]));
    const net = (c: typeof a.computed, kind: string) => c.lines.filter((l) => l.kind === kind).reduce((s, l) => s + l.totalCents - l.taxCents, 0);
    expect(got["Membership revenue"]).toEqual({ net: net(a.computed, "membership"), tax: 0 });
    expect(got["Fee revenue"]).toEqual({ net: net(a.computed, "fee"), tax: 0 });
    expect(got["Retail sales"]).toEqual({ net: net(b.computed, "product"), tax: b.computed.taxCents });
    expect(got["Adjustments & returns"]?.net).toBe(net(b.computed, "adjustment"));
    const total = rows.reduce((s, r) => s + r.net + r.tax, 0);
    expect(total).toBe(a.computed.totalCents + b.computed.totalCents);
  });

  it("each membership's MRR = monthlyEquivalent(price, interval)", async () => {
    const rows = await asClaims(owner, (tx) => tx<{ membership_id: string; mrr_cents: number }[]>`select membership_id, mrr_cents from public.v_membership_mrr where household_id = ${household}`);
    const got = Object.fromEntries(rows.map((r) => [r.membership_id, r.mrr_cents]));
    expect(got[ms.monthly]).toBe(monthlyEquivalent(16900, "month"));
    expect(got[ms.weekly]).toBe(monthlyEquivalent(4500, "week"));
    expect(got[ms.yearly]).toBe(monthlyEquivalent(120000, "year"));
    expect(got[ms.pif]).toBeUndefined(); // paid-in-full isn't recurring
  });

  it("MRR history: this month gains the live memberships; last month shows the churn", async () => {
    const after = await mrr();
    const delta = (i: number, k: keyof MrrRow) => Number(after[i]?.[k] ?? 0) - Number(before[i]?.[k] ?? 0);
    const last = after.length - 1;
    expect(delta(last, "mrr_cents")).toBe(monthlyEquivalent(16900, "month") + monthlyEquivalent(4500, "week"));
    expect(delta(last, "new_mrr_cents")).toBe(monthlyEquivalent(4500, "week"));
    expect(delta(last - 1, "churned_mrr_cents")).toBe(monthlyEquivalent(120000, "year"));
    expect(delta(last - 2, "mrr_cents")).toBe(monthlyEquivalent(16900, "month") + monthlyEquivalent(120000, "year"));
  });

  it("deferred revenue on a paid-in-full membership = engine deferredRevenue", async () => {
    const start = addMonthsStr(today, -2);
    const inv = await invoice([{ kind: "membership", description: "Six months", unitCents: 89900 }], ms.pif, start);
    const [p] = await sql<{ id: string }[]>`insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status) values (${R}, ${household}, ${inv.id}, 89900, 'cash', 'succeeded') returning id`;
    await sql`insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (${R}, ${p?.id ?? ""}, ${inv.id}, 89900)`;
    const [row] = await asClaims(owner, (tx) => tx<{ amount_cents: number; deferred_cents: number }[]>`select amount_cents, deferred_cents from public.v_deferred_revenue where membership_id = ${ms.pif}`);
    expect(row?.amount_cents).toBe(89900);
    expect(row?.deferred_cents).toBe(deferredRevenue(89900, start, 6, today));
  });

  it("payments ledger: payments positive, refunds negative with credit-note references", async () => {
    const inv = await invoice([{ kind: "fee", description: "Seminar", unitCents: 6000 }], null, today);
    const [p] = await asClaims(owner, (tx) => tx<{ id: string }[]>`select public.record_manual_payment(${inv.id}, 6000, 'cash') as id`);
    await asClaims(owner, (tx) => tx`select public.record_refund(${p?.id ?? ""}, 2500, 'Missed day')`);
    const rows = await asClaims(owner, (tx) => tx<{ kind: string; amount_cents: number; reference: string }[]>`select kind, amount_cents, reference from public.v_payments_ledger where invoice_number = (select number from public.invoices where id = ${inv.id}) order by at`);
    expect(rows.map((r) => [r.kind, r.amount_cents])).toEqual([["payment", 6000], ["refund", -2500]]);
    expect(rows[1]?.reference).toMatch(/^CN-\d+: Missed day$/);
  });
});
