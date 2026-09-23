import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runJob } from "@/server/jobs/runner";
import { sid } from "../../scripts/lib/ids";
import { sql } from "./harness";

const R = sid("tenant:ridgeline");
const PLAN = sid("plan:ridgeline:monthly-unlimited"); // $169/month, family 10% / 20%
const NOW = new Date("2026-10-01T15:00:00Z"); // 11:00 in New York → billing date 2026-10-01
const TODAY = "2026-10-01";
const household = randomUUID();
const kids = [randomUUID(), randomUUID(), randomUUID()];
const ids = { a: randomUUID(), b: randomUUID(), held: randomUUID(), cancelled: randomUUID() };
let pastDueInvoice = "";

beforeAll(async () => {
  await sql`insert into public.households (id, tenant_id, name) values (${household}, ${R}, 'Billing run family')`;
  for (const [i, k] of kids.entries()) {
    await sql`insert into public.people (id, tenant_id, first_name, last_name, type_flags) values (${k}, ${R}, ${`Kid${i}`}, 'Runner', ${["student"]})`;
    await sql`insert into public.household_members (tenant_id, household_id, person_id, relationship) values (${R}, ${household}, ${k}, 'student')`;
  }
  const insert = (id: string, person: string, extra: Record<string, unknown>) => sql`insert into public.memberships ${sql({
    id, tenant_id: R, household_id: household, person_id: person, plan_id: PLAN, status: "active", starts_at: "2026-09-01", billing_day: 1, next_bill_at: TODAY, ...extra,
  } as unknown as Record<string, string>)}`;
  await insert(ids.a, kids[0] ?? "", {});
  await insert(ids.b, kids[1] ?? "", {});
  await insert(ids.held, kids[2] ?? "", { hold_from: "2026-10-01", hold_until: "2026-10-16", price_override_cents: 15500 });
  await insert(ids.cancelled, kids[2] ?? "", { cancel_at: "2026-10-01" });
  const [n] = await sql<{ n: string }[]>`select app.next_counter(${R}, 'invoice') as n`;
  const [inv] = await sql<{ id: string }[]>`insert into public.invoices (tenant_id, household_id, number, subtotal_cents, total_cents, due_at) values (${R}, ${household}, ${n?.n ?? 0}, 500, 500, '2026-09-20') returning id`;
  pastDueInvoice = inv?.id ?? "";
});

afterAll(async () => {
  await sql`delete from public.invoices where household_id = ${household}`;
  await sql`delete from public.households where id = ${household}`;
  await sql`delete from public.people where id = any(${kids})`;
  await sql.end();
});

const invoicesFor = () => sql<{ membership_id: string; total_cents: number; discount_cents: number; period_start: string; period_end: string; status: string; source: string }[]>`
  select membership_id, total_cents, discount_cents, period_start::text, period_end::text, status, source from public.invoices where household_id = ${household} and source = 'billing_run'`;

describe("billing_run job", () => {
  it("invoices each due membership once, with family ranking, hold proration and cancellations", async () => {
    const r = await runJob("billing_run", { tenantId: R, now: NOW });
    expect(r.status).toBe("ok");
    const inv = await invoicesFor();
    const by = new Map(inv.map((i) => [i.membership_id, i]));
    expect(inv).toHaveLength(3);
    expect(by.has(ids.cancelled)).toBe(false);
    for (const i of inv) expect(i).toMatchObject({ period_start: TODAY, period_end: "2026-11-01", source: "billing_run" });
    // a and b share the $169 price: the lower id ranks first (full price), the other gets 10%.
    const [first, second] = [ids.a, ids.b].sort();
    expect(by.get(first ?? "")?.discount_cents).toBe(0);
    expect(by.get(second ?? "")?.discount_cents).toBe(1690);
    // The held membership ($155 override, cheapest → 3rd: 20%) is billed for 16 of 31 days.
    const held = Math.round((15500 * 16) / 31);
    expect(by.get(ids.held)).toMatchObject({ discount_cents: Math.round(held * 0.2), total_cents: held - Math.round(held * 0.2) });

    const ms = await sql<{ id: string; status: string; next_bill_at: string }[]>`select id, status, next_bill_at::text from public.memberships where household_id = ${household}`;
    const mBy = new Map(ms.map((m) => [m.id, m]));
    expect(mBy.get(ids.a)?.next_bill_at).toBe("2026-11-01");
    expect(mBy.get(ids.cancelled)?.status).toBe("cancelled");
    expect(mBy.get(ids.held)?.status).toBe("on_hold");
    const [pd] = await sql`select status from public.invoices where id = ${pastDueInvoice}`;
    expect(pd?.status).toBe("past_due");
    const [run] = await sql`select status, invoices_created from public.billing_runs where tenant_id = ${R} and run_date = ${TODAY} order by created_at desc limit 1`;
    expect(run?.status).toBe("ok");
    expect(run?.invoices_created).toBeGreaterThanOrEqual(3);
  });

  it("running twice creates no duplicate invoices", async () => {
    const before = (await invoicesFor()).length;
    const r = await runJob("billing_run", { tenantId: R, now: NOW });
    expect(r.status).toBe("ok");
    expect((await invoicesFor()).length).toBe(before);
    // Even if next_bill_at were rewound, the (membership, period) key holds.
    await sql`update public.memberships set next_bill_at = ${TODAY} where id = ${ids.a}`;
    await runJob("billing_run", { tenantId: R, now: NOW });
    expect((await invoicesFor()).filter((i) => i.membership_id === ids.a)).toHaveLength(1);
    const [m] = await sql`select next_bill_at::text from public.memberships where id = ${ids.a}`;
    expect(m?.next_bill_at).toBe("2026-11-01");
  });

  it("without Stripe, autopay memberships are invoiced and the skip is reported honestly", async () => {
    const [pm] = await sql<{ id: string }[]>`insert into public.payment_methods (tenant_id, household_id, stripe_payment_method_id, kind, brand, last4)
      values (${R}, ${household}, ${`pm_run_${household.slice(0, 8)}`}, 'card', 'visa', '4242') returning id`;
    await sql`update public.memberships set autopay = true, payment_method_id = ${pm?.id ?? ""}, next_bill_at = '2026-11-01' where id = ${ids.b}`;
    const saved = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const savedMock = process.env.STRIPE_MOCK;
    delete process.env.STRIPE_MOCK;
    try {
      const r = await runJob("billing_run", { tenantId: R, now: new Date("2026-11-01T15:00:00Z") });
      expect(r.status).toBe("ok");
      expect(r.stats.autopay_skipped).toBe(1);
    } finally {
      if (savedMock) process.env.STRIPE_MOCK = savedMock;
      if (saved) process.env.STRIPE_SECRET_KEY = saved;
    }
    const [run] = await sql<{ errors: string[] }[]>`select errors from public.billing_runs where tenant_id = ${R} and run_date = '2026-11-01' order by created_at desc limit 1`;
    expect(run?.errors).toEqual(["1 autopay charge(s) not attempted: Stripe isn't configured on this server"]);
    const [inv] = await sql`select status from public.invoices where membership_id = ${ids.b} and period_start = '2026-11-01'`;
    expect(inv?.status).toBe("open");
  });
});
