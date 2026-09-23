"use server";

import { DbError, rpc } from "@koryo/db";
import { chargeCard, collectOnReader, feeBpsFromEnv, refundPayment } from "@koryo/payments";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import type { Json } from "@koryo/db/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { chargeInvoiceWithCard } from "../billing/charge";
import { notify } from "../comms";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";
import { logger } from "../log";
import { readyStripe, stripeErrorMessage } from "../payments/stripe";
import { priceCart } from "../pos/cart";

const need = { permission: "retail.sell", module: "retail" } as const;
const uuid = z.uuid();
const dbMessage = (err: unknown, fallback: string) => (err instanceof DbError && ["22023", "P0002"].includes(err.code ?? "") ? err.message.charAt(0).toUpperCase() + err.message.slice(1) + "." : fallback);

export interface PosItem {
  variantId: string;
  name: string;
  size: string | null;
  sku: string;
  barcode: string | null;
  priceCents: number;
  onHand: number;
}

/** Search the catalogue by name, SKU or barcode (an exact barcode/SKU match comes first). */
export async function searchPosItems(input: { q: string; locationId: string }): Promise<ActionResult<PosItem[]>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const q = input.q.trim().replace(/[%_,()]/g, " ").trim();
  if (!q || !uuid.safeParse(input.locationId).success) return ok([]);
  const { data } = await ctx.supabase
    .from("v_inventory")
    .select("variant_id, product_name, options, sku, barcode, price_cents, on_hand")
    .eq("location_id", input.locationId)
    .or(`product_name.ilike.%${q}%,sku.ilike.%${q}%,barcode.eq.${q}`)
    .order("product_name")
    .limit(30);
  const items = (data ?? []).map((r) => ({
    variantId: r.variant_id ?? "", name: r.product_name ?? "", size: (r.options as { size?: string } | null)?.size ?? null, sku: r.sku ?? "",
    barcode: r.barcode, priceCents: r.price_cents ?? 0, onHand: r.on_hand ?? 0,
  }));
  const exact = (i: PosItem) => i.barcode === q || i.sku.toLowerCase() === q.toLowerCase();
  return ok(items.sort((a, b) => Number(exact(b)) - Number(exact(a))));
}

export interface PosQuote {
  lines: { variantId: string; description: string; qty: number; unitCents: number; discountCents: number; taxCents: number; totalCents: number }[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

const cartSchema = z.object({
  locationId: z.uuid(),
  lines: z.array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1).max(999), discountCents: z.number().int().min(0).default(0) })).min(1, { error: "The cart is empty" }).max(100),
});

/** Engine-priced totals for the cart (display); openSale re-prices on the server. */
export async function quoteCart(input: z.input<typeof cartSchema>): Promise<ActionResult<PosQuote>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = cartSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the cart");
  const r = await priceCart(ctx, parsed.data.locationId, parsed.data.lines);
  if ("error" in r) return fail(r.error);
  return ok({ lines: r.lines, subtotalCents: r.invoice.subtotalCents, discountCents: r.invoice.discountCents, taxCents: r.invoice.taxCents, totalCents: r.invoice.totalCents });
}

const openSchema = cartSchema.extend({ householdId: z.uuid().nullish(), personId: z.uuid().nullish() });

export async function openSale(input: z.input<typeof openSchema>): Promise<ActionResult<{ saleId: string; invoiceId: string; totalCents: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = openSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the cart");
  const v = parsed.data;
  const priced = await priceCart(ctx, v.locationId, v.lines);
  if ("error" in priced) return fail(priced.error);
  try {
    const r = (await rpc(ctx.supabase, "pos_open_sale", {
      p: {
        location_id: v.locationId, household_id: v.householdId ?? null, person_id: v.personId ?? null,
        subtotal_cents: priced.invoice.subtotalCents, discount_cents: priced.invoice.discountCents, tax_cents: priced.invoice.taxCents, total_cents: priced.invoice.totalCents,
        lines: priced.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty, unit_cents: l.unitCents, discount_cents: l.discountCents, tax_cents: l.taxCents, total_cents: l.totalCents, tax_rate: l.taxRate || null, description: l.description })),
      } as unknown as Json,
    })) as { sale_id: string; invoice_id: string };
    return ok({ saleId: r.sale_id, invoiceId: r.invoice_id, totalCents: priced.invoice.totalCents });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't start the sale."));
  }
}

export interface TenderResult {
  balanceCents: number;
  changeCents: number;
  completed: boolean;
  receiptNumber: number | null;
}

const toResult = (r: { balance_cents: number; change_cents: number; completed: boolean; receipt_number: number | null }): TenderResult => ({
  balanceCents: r.balance_cents, changeCents: r.change_cents, completed: r.completed, receiptNumber: r.receipt_number,
});

const tenderSchema = z.object({
  saleId: z.uuid(),
  method: z.enum(["cash", "check", "external", "credit"]),
  amountCents: z.number().int().positive(),
  tenderedCents: z.number().int().positive().optional(),
});

export async function addTender(input: z.input<typeof tenderSchema>): Promise<ActionResult<TenderResult>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = tenderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the amount");
  const v = parsed.data;
  try {
    const r = await rpc(ctx.supabase, "pos_add_tender", { p_sale_id: v.saleId, p_method: v.method, p_amount_cents: v.amountCents, p_tendered_cents: v.tenderedCents });
    revalidatePath("/desk/pos");
    return ok(toResult(r as never));
  } catch (err) {
    return fail(dbMessage(err, "Couldn't take that payment."));
  }
}

/** Card on file (the attached household's saved card), off-session through Stripe. */
export async function tenderCardOnFile(input: { saleId: string; paymentMethodId: string; amountCents: number; attemptKey: string }): Promise<ActionResult<TenderResult>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({ saleId: z.uuid(), paymentMethodId: z.uuid(), amountCents: z.number().int().min(50), attemptKey: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Card payments must be at least $0.50.");
  const v = parsed.data;
  const { data: sale } = await ctx.supabase.from("pos_sales").select("invoice_id, status").eq("id", v.saleId).maybeSingle();
  if (!sale?.invoice_id || sale.status !== "open") return fail("This sale is not open.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  try {
    const r = await chargeInvoiceWithCard(ctx.supabase, ready.stripe, { tenantId: ctx.tenantId as string, account: ready.account, currency: ctx.currency }, sale.invoice_id, {
      attemptKey: `pos:${v.attemptKey}`, paymentMethodId: v.paymentMethodId, as: "staff", description: "Point of sale", amountCents: v.amountCents,
    });
    if (r.status !== "succeeded" || !r.paymentId) return fail(r.error ?? "The card payment is still processing; try another tender.");
    const t = await rpc(ctx.supabase, "pos_add_tender", { p_sale_id: v.saleId, p_method: "card", p_amount_cents: v.amountCents, p_payment_id: r.paymentId });
    return ok(toResult(t as never));
  } catch (err) {
    return fail(err instanceof DbError ? dbMessage(err, "Couldn't record the card payment.") : stripeErrorMessage(err));
  }
}

/** Stripe Terminal: send the amount to a registered reader (test mode presents a test card on the simulated reader). */
export async function tenderTerminal(input: { saleId: string; readerId: string; amountCents: number; attemptKey: string }): Promise<ActionResult<TenderResult>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({ saleId: z.uuid(), readerId: z.uuid(), amountCents: z.number().int().min(50), attemptKey: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Card payments must be at least $0.50.");
  const v = parsed.data;
  const [{ data: sale }, { data: reader }] = await Promise.all([
    ctx.supabase.from("pos_sales").select("invoice_id, status, household_id, invoices(household_id, balance_cents)").eq("id", v.saleId).maybeSingle(),
    ctx.supabase.from("terminal_readers").select("stripe_reader_id").eq("id", v.readerId).maybeSingle(),
  ]);
  if (!sale?.invoice_id || sale.status !== "open" || !sale.invoices) return fail("This sale is not open.");
  if (!reader) return fail("Choose a card reader.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  try {
    const pi = await chargeCard(ready.stripe, ready.account, {
      tenantId: ctx.tenantId as string, householdId: sale.invoices.household_id,
      amountCents: Math.min(v.amountCents, sale.invoices.balance_cents), currency: ctx.currency, offSession: false, invoiceId: sale.invoice_id,
      attemptKey: `terminal:${v.attemptKey}`, method: "terminal", description: "Point of sale", feeBps: feeBpsFromEnv(),
    });
    const settled = await collectOnReader(ready.stripe, ready.account, { readerId: reader.stripe_reader_id, paymentIntentId: pi.id, simulate: (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_") });
    const paymentId = await rpc(ctx.supabase, "record_payment_intent", { p_pi: settled as unknown as Json });
    if (settled.status !== "succeeded" || !paymentId) return fail(settled.last_payment_error?.message ?? "The reader payment didn't complete.");
    const t = await rpc(ctx.supabase, "pos_add_tender", { p_sale_id: v.saleId, p_method: "terminal", p_amount_cents: settled.amount_received, p_payment_id: paymentId });
    return ok(toResult(t as never));
  } catch (err) {
    logger(ctx).warn({ err: err instanceof Error ? err.message : String(err) }, "terminal payment failed");
    return fail(err instanceof DbError ? dbMessage(err, "Couldn't record the reader payment.") : stripeErrorMessage(err));
  }
}

export async function cancelSale(saleId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  if (!uuid.safeParse(saleId).success) return fail("Invalid sale.");
  try {
    await rpc(ctx.supabase, "pos_cancel_sale", { p_sale_id: saleId });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't cancel the sale."));
  }
  return ok();
}

const returnSchema = z.object({
  saleId: z.uuid(),
  lines: z.array(z.object({ lineId: z.uuid(), qty: z.number().int().min(1) })).min(1, { error: "Choose items to return" }),
  refundTo: z.enum(["original", "credit"]),
  reason: z.string().trim().min(2, { error: "Give a reason" }).max(200),
});

/** Return items from a completed sale: restock, refund (cash back, card at Stripe, or account credit). */
export async function returnItems(input: z.input<typeof returnSchema>): Promise<ActionResult<{ returnSaleId: string; refundCents: number; cashOutCents: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the return");
  const v = parsed.data;
  let r: { return_sale_id: string; refund_cents: number; cash_out_cents: number; stripe: { payment_id: string; amount_cents: number }[] };
  try {
    r = (await rpc(ctx.supabase, "pos_return", {
      p: { original_sale_id: v.saleId, lines: v.lines.map((l) => ({ line_id: l.lineId, qty: l.qty })), refund_to: v.refundTo, reason: v.reason } as unknown as Json,
    })) as typeof r;
  } catch (err) {
    return fail(dbMessage(err, "Couldn't process the return."));
  }
  // Card portions: refund at Stripe, then record (needs billing.refund).
  if (r.stripe.length) {
    const ready = await readyStripe(ctx);
    for (const s of r.stripe) {
      const { data: p } = await ctx.supabase.from("payments").select("id, stripe_payment_intent_id, refunded_cents").eq("id", s.payment_id).maybeSingle();
      if (!p?.stripe_payment_intent_id || "error" in ready) {
        logger(ctx).error({ payment: s.payment_id }, "card refund for a POS return could not be sent to Stripe");
        return fail(`Items returned, but the ${formatMoney(s.amount_cents, ctx.currency)} card refund couldn't be sent to Stripe. Refund it from the invoice.`);
      }
      try {
        const refund = await refundPayment(ready.stripe, ready.account, { paymentIntentId: p.stripe_payment_intent_id, amountCents: s.amount_cents, refundKey: `pos:${r.return_sale_id}:${p.id}` });
        await rpc(ctx.supabase, "record_refund", { p_payment_id: p.id, p_amount_cents: s.amount_cents, p_reason: `${v.reason} (POS return)`, p_stripe_refund_id: refund.id });
      } catch (err) {
        return fail(`Items returned; card refund problem: ${err instanceof DbError ? err.message : stripeErrorMessage(err)}`);
      }
    }
  }
  revalidatePath("/desk/pos");
  return ok({ returnSaleId: r.return_sale_id, refundCents: r.refund_cents, cashOutCents: r.cash_out_cents });
}

export async function openDrawer(input: { locationId: string; openingCents: number }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({ locationId: z.uuid(), openingCents: z.number().int().min(0).max(10_000_000) }).safeParse(input);
  if (!parsed.success) return fail("Enter the starting cash.");
  try {
    await rpc(ctx.supabase, "pos_open_drawer", { p_location_id: parsed.data.locationId, p_opening_cents: parsed.data.openingCents });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't open the drawer."));
  }
  revalidatePath("/desk/pos");
  return ok();
}

export async function closeDrawer(input: { drawerId: string; countedCents: number }): Promise<ActionResult<{ expectedCents: number; countedCents: number; varianceCents: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({ drawerId: z.uuid(), countedCents: z.number().int().min(0).max(10_000_000) }).safeParse(input);
  if (!parsed.success) return fail("Enter the counted cash.");
  try {
    const r = (await rpc(ctx.supabase, "pos_close_drawer", { p_drawer_id: parsed.data.drawerId, p_counted_cents: parsed.data.countedCents })) as { expected_cents: number; counted_cents: number; variance_cents: number };
    revalidatePath("/desk/pos");
    return ok({ expectedCents: r.expected_cents, countedCents: r.counted_cents, varianceCents: r.variance_cents });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't close the drawer."));
  }
}

/** Email the sale receipt to the attached household's payer (Outbox when no provider is configured). */
export async function emailSaleReceipt(saleId: string): Promise<ActionResult<{ status: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  if (!uuid.safeParse(saleId).success) return fail("Invalid sale.");
  const { data: s } = await ctx.supabase.from("pos_sales").select("id, receipt_number, total_cents, household_id, person_id, invoice_id, households(primary_payer_person_id), pos_tenders(method, amount_cents, change_cents), invoices(invoice_lines(description, total_cents))").eq("id", saleId).maybeSingle();
  if (!s) return fail("Sale not found.");
  const recipient = s.households?.primary_payer_person_id ?? s.person_id;
  if (!s.household_id || !recipient) return fail("Attach a household to email a receipt.");
  const money = (c: number) => formatMoney(c, ctx.currency);
  const summary = await notify(ctx, {
    personIds: [recipient], templateKey: "payment_receipt", channels: ["email"],
    data: {
      invoice_number: String(s.receipt_number ?? ""), amount: money(s.total_cents), balance: money(0),
      method: [...new Set((s.pos_tenders ?? []).map((t) => t.method))].join(" + ") || "—",
      paid_on: new Date().toLocaleDateString("en-US", { timeZone: ctx.tz, dateStyle: "medium" }),
      lines: (s.invoices?.invoice_lines ?? []).map((l) => `${l.description}: ${money(l.total_cents)}`).join("\n"),
    },
    related: s.invoice_id ? { type: "invoice", id: s.invoice_id } : undefined,
  });
  if (!summary.recipients) return fail("No one in this household has an email address we can use.");
  return ok({ status: Object.keys(summary.byStatus)[0] ?? "none" });
}

export interface PosHousehold {
  id: string;
  name: string;
  cards: { id: string; brand: string | null; last4: string | null; kind: string; is_default: boolean }[];
  creditCents: number;
}

/** Attach a customer: households by name, with their saved cards and available account credit. */
export async function searchPosHouseholds(q: string): Promise<ActionResult<{ id: string; name: string }[]>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const term = q.trim().replace(/[%_]/g, "");
  if (term.length < 2) return ok([]);
  const { data } = await ctx.supabase.from("households").select("id, name").ilike("name", `%${term}%`).is("archived_at", null).neq("external_id", "pos:walk-in").order("name").limit(8);
  return ok(data ?? []);
}

export async function posHouseholdInfo(householdId: string): Promise<ActionResult<PosHousehold>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  if (!uuid.safeParse(householdId).success) return fail("Invalid household.");
  const [{ data: h }, { data: cards }, { data: credits }] = await Promise.all([
    ctx.supabase.from("households").select("id, name").eq("id", householdId).maybeSingle(),
    ctx.supabase.from("payment_methods").select("id, brand, last4, kind, is_default").eq("household_id", householdId).eq("status", "active"),
    ctx.supabase.from("credits").select("remaining_cents").eq("household_id", householdId).gt("remaining_cents", 0),
  ]);
  if (!h) return fail("Household not found.");
  return ok({ ...h, cards: cards ?? [], creditCents: (credits ?? []).reduce((s, c) => s + c.remaining_cents, 0) });
}
