import { computeInvoice } from "@koryo/billing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const LOC = sid("location:ridgeline:main");
const BELT = sid("variant:ridgeline:white-belt:2");
const DOBOK = sid("variant:ridgeline:dobok:3");
let owner: Record<string, unknown>;
const as = <T>(fn: (tx: typeof sql) => Promise<T>) => asClaims(owner, fn);
const onHand = async (v: string) => (await sql<{ on_hand: number }[]>`select on_hand from public.inventory_levels where variant_id = ${v} and location_id = ${LOC}`)[0]?.on_hand ?? 0;
const sales: string[] = [];
let drawer = "";

// Cart: 2 belts ($10) with $2 off, 1 dobok ($55); retail tax 5.3%.
const invoice = computeInvoice([
  { kind: "product", description: "White belt (2)", unitCents: 1000, quantity: 2, taxClass: "retail", discountable: true, lineDiscountCents: 200 },
  { kind: "product", description: "Dobok (uniform) (3)", unitCents: 5500, quantity: 1, taxClass: "retail", discountable: true },
], [], { retail: 0.053 });
const payload = () => ({
  location_id: LOC, subtotal_cents: invoice.subtotalCents, discount_cents: invoice.discountCents, tax_cents: invoice.taxCents, total_cents: invoice.totalCents,
  lines: [
    { variant_id: BELT, qty: 2, unit_cents: 1000, discount_cents: 200, tax_cents: invoice.lines[0]?.taxCents, total_cents: invoice.lines[0]?.totalCents, tax_rate: 0.053, description: "White belt (2)" },
    { variant_id: DOBOK, qty: 1, unit_cents: 5500, discount_cents: 0, tax_cents: invoice.lines[1]?.taxCents, total_cents: invoice.lines[1]?.totalCents, tax_rate: 0.053, description: "Dobok (uniform) (3)" },
  ],
});

beforeAll(async () => {
  owner = await seededClaims("owner@ridgelinetkd.demo");
  await sql`update public.cash_drawers set closed_at = now() where location_id = ${LOC} and closed_at is null`;
});

afterAll(async () => {
  const inv = await sql<{ invoice_id: string }[]>`select invoice_id from public.pos_sales where id = any(${sales}) or original_sale_id = any(${sales})`;
  const movements = await sql<{ variant_id: string; s: number }[]>`select variant_id, sum(delta)::int as s from public.inventory_movements where ref_type = 'pos_sale' and ref_id in (select id from public.pos_sales where id = any(${sales}) or original_sale_id = any(${sales})) group by variant_id`;
  for (const m of movements) await sql`update public.inventory_levels set on_hand = on_hand - ${m.s} where variant_id = ${m.variant_id} and location_id = ${LOC}`;
  await sql`delete from public.inventory_movements where ref_type = 'pos_sale' and ref_id in (select id from public.pos_sales where id = any(${sales}) or original_sale_id = any(${sales}))`;
  await sql`delete from public.pos_sales where original_sale_id = any(${sales})`;
  await sql`delete from public.pos_sales where id = any(${sales})`;
  const ids = inv.map((i) => i.invoice_id);
  await sql`delete from public.payments where invoice_id = any(${ids})`;
  await sql`delete from public.invoices where id = any(${ids})`;
  if (drawer) await sql`delete from public.cash_drawers where id = ${drawer}`;
  await sql.end();
});

describe("POS", () => {
  it("refuses client prices that don't match the catalogue, and cash without an open drawer", async () => {
    const bad = payload();
    (bad.lines[0] as { unit_cents: number }).unit_cents = 1;
    await expect(as((tx) => tx`select public.pos_open_sale(${sql.json(bad)})`)).rejects.toMatchObject({ code: "22023" });
    const [r] = await as((tx) => tx<{ r: { sale_id: string } }[]>`select public.pos_open_sale(${sql.json(payload())}) as r`);
    sales.push(r?.r.sale_id ?? "");
    await expect(as((tx) => tx`select public.pos_add_tender(${r?.r.sale_id ?? ""}, 'cash', 100, 100)`)).rejects.toMatchObject({ code: "22023" });
    await as((tx) => tx`select public.pos_cancel_sale(${r?.r.sale_id ?? ""})`);
    const [s] = await sql`select s.status, i.status as inv from public.pos_sales s join public.invoices i on i.id = s.invoice_id where s.id = ${r?.r.sale_id ?? ""}`;
    expect(s).toEqual({ status: "void", inv: "void" });
  });

  it("split tender (check + cash with change) completes the sale, takes stock out and counts the drawer", async () => {
    const [d] = await as((tx) => tx<{ id: string }[]>`select public.pos_open_drawer(${LOC}, 10000) as id`);
    drawer = d?.id ?? "";
    const beltBefore = await onHand(BELT);
    const [r] = await as((tx) => tx<{ r: { sale_id: string; invoice_id: string } }[]>`select public.pos_open_sale(${sql.json(payload())}) as r`);
    const sale = r?.r.sale_id ?? "";
    sales.push(sale);
    const [t1] = await as((tx) => tx<{ r: { balance_cents: number; completed: boolean } }[]>`select public.pos_add_tender(${sale}, 'check', 2000) as r`);
    expect(t1?.r).toMatchObject({ balance_cents: invoice.totalCents - 2000, completed: false });
    const [t2] = await as((tx) => tx<{ r: { balance_cents: number; change_cents: number; completed: boolean; receipt_number: number } }[]>`select public.pos_add_tender(${sale}, 'cash', 10000, 10000) as r`);
    expect(t2?.r).toMatchObject({ balance_cents: 0, completed: true, change_cents: 10000 - (invoice.totalCents - 2000) });
    expect(Number(t2?.r.receipt_number)).toBeGreaterThan(0);
    expect(await onHand(BELT)).toBe(beltBefore - 2);
    const [inv] = await sql`select status, source from public.invoices where id = ${r?.r.invoice_id ?? ""}`;
    expect(inv).toEqual({ status: "paid", source: "pos" });
    const [exp] = await as((tx) => tx<{ e: number }[]>`select public.pos_drawer_expected(${drawer}) as e`);
    expect(exp?.e).toBe(10000 + (invoice.totalCents - 2000));
  });

  it("returning one belt restocks it, refunds cash from the drawer, and leaves the invoice paid", async () => {
    const sale = sales[1] ?? "";
    const beltBefore = await onHand(BELT);
    const [line] = await sql<{ id: string; total_cents: number }[]>`select id, total_cents from public.pos_sale_lines where sale_id = ${sale} and variant_id = ${BELT}`;
    const [r] = await as((tx) => tx<{ r: { refund_cents: number; cash_out_cents: number; stripe: unknown[] } }[]>`select public.pos_return(${sql.json({ original_sale_id: sale, lines: [{ line_id: line?.id, qty: 1 }], refund_to: "original", reason: "Wrong size" })}) as r`);
    expect(r?.r.refund_cents).toBe(Math.round((line?.total_cents ?? 0) / 2));
    expect(r?.r.stripe).toEqual([]);
    expect(await onHand(BELT)).toBe(beltBefore + 1);
    const [inv] = await sql`select i.status, i.balance_cents from public.invoices i join public.pos_sales s on s.invoice_id = i.id where s.id = ${sale}`;
    expect(inv).toEqual({ status: "paid", balance_cents: 0 });
    const refunds = await sql`select r.credit_note_number from public.refunds r join public.payments p on p.id = r.payment_id join public.pos_sales s on s.invoice_id = p.invoice_id where s.id = ${sale}`;
    expect(refunds.length).toBeGreaterThan(0);
    await expect(as((tx) => tx`select public.pos_return(${sql.json({ original_sale_id: sale, lines: [{ line_id: line?.id, qty: 2 }], refund_to: "original", reason: "again" })})`)).rejects.toMatchObject({ code: "22023" });

    const counted = 10000 + (invoice.totalCents - 2000) - (r?.r.cash_out_cents ?? 0) - 100; // $1 short
    const [c] = await as((tx) => tx<{ r: { expected_cents: number; variance_cents: number } }[]>`select public.pos_close_drawer(${drawer}, ${counted}) as r`);
    expect(c?.r.variance_cents).toBe(-100);
  });

  it("a core-only tenant can't use the POS", async () => {
    const harbor = await seededClaims("owner@harborbjj.demo");
    await expect(asClaims(harbor, (tx) => tx`select public.pos_open_drawer(${LOC}, 0)`)).rejects.toMatchObject({ code: "42501" });
  });
});
