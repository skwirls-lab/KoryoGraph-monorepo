import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const ADAMS = sid("household:ridgeline:adams");
let owner: Record<string, unknown>;
const made: string[] = [];

async function invoice(total: number) {
  const [n] = await sql<{ n: string }[]>`select app.next_counter(${R}, 'invoice') as n`;
  const [i] = await sql<{ id: string }[]>`insert into public.invoices (tenant_id, household_id, number, subtotal_cents, total_cents, due_at, memo)
    values (${R}, ${ADAMS}, ${n?.n ?? 0}, ${total}, ${total}, current_date + 7, 'ar test') returning id`;
  made.push(i?.id ?? "");
  return i?.id ?? "";
}
const state = async (id: string) => (await sql<{ status: string; paid_cents: number; balance_cents: number; total_cents: number }[]>`select status, paid_cents, balance_cents, total_cents from public.invoices where id = ${id}`)[0];
const as = <T>(fn: (tx: typeof sql) => Promise<T>) => asClaims(owner, fn);

beforeAll(async () => {
  owner = await seededClaims("owner@ridgelinetkd.demo");
  await sql`delete from public.credits where household_id = ${ADAMS}`;
});
afterAll(async () => {
  await sql`delete from public.invoices where id = any(${made})`;
  await sql`delete from public.credits where household_id = ${ADAMS}`;
  await sql.end();
});

describe("AR operations", () => {
  it("cash payment pays the invoice; overpayment becomes credit that can pay another invoice", async () => {
    const a = await invoice(5000);
    await as((tx) => tx`select public.record_manual_payment(${a}, 6000, 'cash', 'front desk')`);
    expect(await state(a)).toMatchObject({ status: "paid", paid_cents: 5000 });
    const [c] = await sql<{ s: number }[]>`select sum(remaining_cents)::int as s from public.credits where household_id = ${ADAMS}`;
    expect(c?.s).toBe(1000);
    const b = await invoice(2500);
    await as((tx) => tx`select public.apply_credit(${b})`);
    expect(await state(b)).toMatchObject({ status: "partially_paid", paid_cents: 1000, balance_cents: 1500 });
    await expect(as((tx) => tx`select public.apply_credit(${b})`)).rejects.toMatchObject({ code: "22023" });
  });

  it("add a fee and a discount line; totals follow; can't discount below what's paid", async () => {
    const i = await invoice(10000);
    await as((tx) => tx`select public.add_invoice_line(${i}, 'fee', 'Testing fee', 1, 4500)`);
    await as((tx) => tx`select public.add_invoice_line(${i}, 'discount', 'Loyalty', 1, -2000)`);
    expect(await state(i)).toMatchObject({ total_cents: 12500, balance_cents: 12500 });
    const [inv] = await sql`select subtotal_cents, discount_cents from public.invoices where id = ${i}`;
    expect(inv).toEqual({ subtotal_cents: 14500, discount_cents: 2000 });
    await as((tx) => tx`select public.record_manual_payment(${i}, 12000, 'check', 'Check 1042')`);
    await expect(as((tx) => tx`select public.add_invoice_line(${i}, 'discount', 'Too much', 1, -1000)`)).rejects.toMatchObject({ code: "22023" });
  });

  it("partial refund → payment partially_refunded, invoice reopens, numbered credit note; refund to account credit", async () => {
    const i = await invoice(8000);
    const pid = (await as((tx) => tx<{ pid: string }[]>`select public.record_manual_payment(${i}, 8000, 'cash') as pid`))[0]?.pid ?? "";
    const rid = (await as((tx) => tx<{ rid: string }[]>`select public.record_refund(${pid}, 3000, 'Missed classes') as rid`))[0]?.rid ?? "";
    const [p] = await sql`select status, refunded_cents from public.payments where id = ${pid}`;
    expect(p).toEqual({ status: "partially_refunded", refunded_cents: 3000 });
    expect(await state(i)).toMatchObject({ status: "partially_paid", paid_cents: 5000 });
    const [r] = await sql`select credit_note_number, as_credit from public.refunds where id = ${rid}`;
    expect(Number(r?.credit_note_number)).toBeGreaterThan(0);
    expect(r?.as_credit).toBe(false);

    await as((tx) => tx`select public.record_refund(${pid}, 2000, 'Goodwill', null, true)`);
    const [credit] = await sql<{ amount_cents: number; reason: string }[]>`select amount_cents, reason from public.credits where source_ref like 'refund:%' and household_id = ${ADAMS} order by created_at desc limit 1`;
    expect(credit?.amount_cents).toBe(2000);
    expect(credit?.reason).toMatch(/^Credit note CN-\d+: Goodwill$/);
    const activity = await sql`select kind from public.v_invoice_activity where invoice_id = ${i}`;
    expect(activity.filter((a) => a.kind === "credit_note")).toHaveLength(2);
  });

  it("void only unpaid invoices; front desk without billing.refund can't refund; parents can't do any of it", async () => {
    const i = await invoice(3000);
    await expect(as((tx) => tx`select public.void_invoice(${i}, 'x')`)).rejects.toMatchObject({ code: "22023" });
    await as((tx) => tx`select public.void_invoice(${i}, 'Entered twice')`);
    expect((await state(i))?.status).toBe("void");
    await expect(as((tx) => tx`select public.record_manual_payment(${i}, 100, 'cash')`)).rejects.toMatchObject({ code: "22023" });
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.record_manual_payment(${i}, 100, 'cash')`)).rejects.toMatchObject({ code: "42501" });
    const frontDesk = await seededClaims("frontdesk@ridgelinetkd.demo");
    const perms = (frontDesk.app_metadata as { permissions: string[] }).permissions;
    if (!perms.includes("billing.refund")) {
      await expect(asClaims(frontDesk, (tx) => tx`select public.record_refund(gen_random_uuid(), 100, 'x')`)).rejects.toMatchObject({ code: "42501" });
    }
  });
});
