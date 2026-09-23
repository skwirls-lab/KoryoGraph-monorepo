import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const H = sid("tenant:harbor");
const HH = sid("household:ridgeline:adams");
const created: string[] = [];

async function invoice(total: number, due: string, status = "open") {
  const [n] = await sql<{ n: string }[]>`select app.next_counter(${R}, 'invoice') as n`;
  const [inv] = await sql<{ id: string }[]>`insert into public.invoices (tenant_id, household_id, number, total_cents, subtotal_cents, due_at, status)
    values (${R}, ${HH}, ${n?.n ?? 0}, ${total}, ${total}, ${due}, ${status}) returning id`;
  created.push(inv?.id ?? "");
  return inv?.id ?? "";
}
async function pay(invoiceId: string, cents: number) {
  const [p] = await sql<{ id: string }[]>`insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status) values (${R}, ${HH}, ${invoiceId}, ${Math.abs(cents)}, 'cash', 'succeeded') returning id`;
  await sql`insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (${R}, ${p?.id ?? ""}, ${invoiceId}, ${cents})`;
  return p?.id ?? "";
}
const state = async (id: string) => (await sql<{ status: string; paid_cents: number; balance_cents: number }[]>`select status, paid_cents, balance_cents from public.invoices where id = ${id}`)[0];
const future = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
const past = new Date(Date.now() - 10 * 86400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  await sql`delete from public.credits where household_id = ${HH}`;
});

afterAll(async () => {
  await sql`delete from public.invoices where id = any(${created})`;
  await sql`delete from public.credits where household_id = ${HH}`;
  await sql.end();
});

describe("invoice state machine (allocation-driven)", () => {
  it("open → partially_paid → paid → partially refunded → refunded", async () => {
    const id = await invoice(10_000, future);
    expect(await state(id)).toEqual({ status: "open", paid_cents: 0, balance_cents: 10_000 });
    await pay(id, 4_000);
    expect(await state(id)).toEqual({ status: "partially_paid", paid_cents: 4_000, balance_cents: 6_000 });
    const p2 = await pay(id, 6_000);
    expect(await state(id)).toEqual({ status: "paid", paid_cents: 10_000, balance_cents: 0 });
    await sql`insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (${R}, ${p2}, ${id}, -3000)`;
    expect(await state(id)).toEqual({ status: "partially_paid", paid_cents: 7_000, balance_cents: 3_000 });
    await sql`insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (${R}, ${p2}, ${id}, -7000)`;
    expect((await state(id))?.status).toBe("refunded");
  });

  it("an unpaid invoice past its due date is past_due from the start; void stays void", async () => {
    const id = await invoice(5_000, past);
    expect((await state(id))?.status).toBe("past_due");
    await sql`update public.invoices set status = 'void', voided_at = now() where id = ${id}`;
    await pay(id, 1_000);
    expect((await state(id))?.status).toBe("void");
  });

  it("household balance = open balances − unexpired credits", async () => {
    const a = await invoice(3_000, future);
    await sql`insert into public.credits (tenant_id, household_id, amount_cents, remaining_cents, reason) values (${R}, ${HH}, 1000, 1000, 'goodwill')`;
    const [h] = await sql<{ balance_cents: number }[]>`select balance_cents from public.households where id = ${HH}`;
    const [truth] = await sql<{ b: number }[]>`select (coalesce((select sum(balance_cents) from invoices where household_id = ${HH} and status in ('open','partially_paid','past_due')),0)
      - coalesce((select sum(remaining_cents) from credits where household_id = ${HH}),0))::int as b`;
    expect(h?.balance_cents).toBe(truth?.b);
    expect(a).toBeTruthy();
  });
});

describe("billing module gate", () => {
  it("a core-only tenant (Harbor) cannot read or write billing rows even as owner", async () => {
    const harborOwner = await seededClaims("owner@harborbjj.demo");
    const meta = harborOwner.app_metadata as { modules: string[] };
    expect(meta.modules).toEqual(["core"]);
    await expect(asClaims(harborOwner, (tx) => tx`insert into public.membership_plans (tenant_id, name, kind, price_cents, interval) values (${H}, 'x', 'recurring', 100, 'month')`)).rejects.toMatchObject({ code: "42501" });
    const rows = await asClaims(harborOwner, (tx) => tx`select id from public.invoices`);
    expect(rows).toHaveLength(0);
  });

  it("the Ridgeline guardian sees only their own household's invoices", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const rows = await asClaims(parent, (tx) => tx<{ household_id: string }[]>`select household_id from public.invoices`);
    expect(rows.every((r) => r.household_id === sid("household:ridgeline:cooper"))).toBe(true);
  });
});
