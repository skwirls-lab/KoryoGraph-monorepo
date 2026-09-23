"use server";

import { DbError, rpc } from "@koryo/db";
import type { Json } from "@koryo/db/types";
import { chargeCard, feeBpsFromEnv } from "@koryo/payments";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney } from "@/lib/curriculum";
import { todayIn } from "@/lib/people";
import { enrollmentQuoteSchema, enrollmentSchema, planSchema, type EnrollmentInput, type EnrollmentQuoteInput, type PlanInput } from "@/lib/validation/billing";
import { chargeInvoiceWithCard } from "../billing/charge";
import { quoteEnrollment, type EnrollmentQuote } from "../billing/enrollment";
import { notify } from "../comms";
import { getCtx } from "../context";
import { storeSignaturePdf } from "../documents/render";
import { authorize } from "../lib/authorize";
import { logger } from "../log";
import { readyStripe, stripeErrorMessage } from "../payments/stripe";

const num = (v: number | "" | undefined) => (v === "" || v === undefined ? null : v);

// ---------------------------------------------------------------------------------------------
// Plans (billing.charge)
// ---------------------------------------------------------------------------------------------

export async function savePlan(input: PlanInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const price = parseMoney(v.price);
  const fee = parseMoney(v.enrollmentFee);
  const etf = v.earlyTerminationFee ? parseMoney(v.earlyTerminationFee) : null;
  if (price === null) return fail("Check the highlighted fields", { price: "Enter an amount like 149 or 149.00" });
  if (fee === null) return fail("Check the highlighted fields", { enrollmentFee: "Enter an amount like 49" });
  const recurring = v.kind === "recurring" || v.kind === "contract";
  const row = {
    name: v.name,
    description: v.description,
    kind: v.kind,
    interval: recurring ? (v.interval || null) : null,
    interval_count: recurring ? v.intervalCount : 1,
    price_cents: price,
    enrollment_fee_cents: fee,
    contract_months: v.kind === "contract" ? num(v.contractMonths) : null,
    early_termination_fee_cents: v.kind === "contract" ? etf : null,
    auto_renew: v.autoRenew,
    term_months: v.kind === "paid_in_full" ? num(v.termMonths) : null,
    class_pack_size: v.kind === "class_pack" ? num(v.classPackSize) : null,
    trial_days: v.kind === "trial" ? num(v.trialDays) : null,
    program_ids: v.programIds,
    attendance_rule: (v.unlimited ? { unlimited: true } : { unlimited: false, classes_per_week: num(v.classesPerWeek) }) as Json,
    family_discount: { second_pct: v.secondPct, third_plus_pct: v.thirdPlusPct } as Json,
    tax_class: v.taxClass,
    gear_package_product_ids: v.gearProductIds,
    public: v.isPublic,
    active: v.active,
  };
  if (v.id) {
    const { error } = await ctx.supabase.from("membership_plans").update(row).eq("id", v.id);
    if (error) return fail("Couldn't save the plan.");
    revalidatePath("/desk/billing/plans");
    return ok({ id: v.id });
  }
  const { count } = await ctx.supabase.from("membership_plans").select("id", { count: "exact", head: true });
  const { data, error } = await ctx.supabase.from("membership_plans").insert({ ...row, tenant_id: ctx.tenantId as string, sort: (count ?? 0) * 10 }).select("id").single();
  if (error || !data) return fail("Couldn't create the plan.");
  revalidatePath("/desk/billing/plans");
  return ok({ id: data.id });
}

export async function setPlanActive(input: { id: string; active: boolean }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const { error } = await ctx.supabase.from("membership_plans").update({ active: input.active }).eq("id", input.id);
  if (error) return fail("Couldn't update the plan.");
  revalidatePath("/desk/billing/plans");
  return ok();
}

// ---------------------------------------------------------------------------------------------
// Enrollment wizard
// ---------------------------------------------------------------------------------------------

export async function previewEnrollment(input: EnrollmentQuoteInput): Promise<ActionResult<EnrollmentQuote>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = enrollmentQuoteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details", issuesToFieldErrors(parsed.error.issues));
  const r = await quoteEnrollment(ctx, parsed.data);
  return "error" in r ? fail(r.error) : ok(r.quote);
}

export interface EnrollmentResult {
  membershipId: string;
  invoiceId: string | null;
  paymentStatus: "paid" | "unpaid" | "failed" | "pending" | "nothing_due";
  message: string;
}

/**
 * Creates the membership from a fresh server-side quote (the preview's numbers are never trusted), then
 * takes payment: cash/check inside the same transaction, card on file through Stripe afterwards.
 */
export async function enrollMembership(input: EnrollmentInput): Promise<ActionResult<EnrollmentResult>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = enrollmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const r = await quoteEnrollment(ctx, v);
  if ("error" in r) return fail(r.error);
  const q = r.quote;
  if (q.couponError) return fail(q.couponError, { couponCode: q.couponError });
  const missingSize = q.gear.find((g) => !g.chosenVariantId);
  if (missingSize) return fail(`Choose a size for ${missingSize.productName}.`);
  const needsSignature = q.contract && !q.contract.alreadySigned;
  if (needsSignature && v.contractSignature.length < 2) return fail("The guardian needs to sign the membership agreement.", { contractSignature: "Type the signer's full name" });

  const total = q.invoice.totalCents;
  let cardMethod: { id: string; stripeId: string } | null = null;
  if (v.payment.method === "card" && total > 0) {
    const { data: pm } = await ctx.supabase.from("payment_methods").select("id, stripe_payment_method_id, status").eq("id", v.payment.paymentMethodId).eq("household_id", v.householdId).maybeSingle();
    if (!pm || pm.status !== "active") return fail("That card isn't available any more.");
    cardMethod = { id: pm.id, stripeId: pm.stripe_payment_method_id };
  }
  const ready = cardMethod ? await readyStripe(ctx) : null;
  if (ready && "error" in ready) return fail(ready.error);

  const payload = {
    household_id: v.householdId,
    person_id: v.personId,
    plan_id: q.plan.id,
    starts_at: q.startsAt,
    billing_day: q.plan.kind === "recurring" || q.plan.kind === "contract" ? q.billingDay : null,
    next_bill_at: q.nextBillAt,
    ends_at: q.endsAt,
    contract_ends_at: q.contractEndsAt,
    discount_ids: q.coupon ? [q.coupon.id] : [],
    autopay: v.autopay && Boolean(cardMethod),
    payment_method_id: cardMethod?.id ?? null,
    notes: v.notes,
    invoice: {
      due_at: q.startsAt,
      subtotal_cents: q.invoice.subtotalCents,
      discount_cents: q.invoice.discountCents,
      tax_cents: q.invoice.taxCents,
      total_cents: total,
      memo: q.coupon ? `Code ${q.coupon.code}` : "",
      lines: q.invoice.lines.map((l) => ({
        kind: l.kind, description: l.discountCents ? `${l.description} (−${(l.discountCents / 100).toFixed(2)})` : l.description,
        quantity: l.quantity, unit_cents: l.unitCents, total_cents: l.totalCents, tax_rate: l.taxRate || null,
      })),
    },
    gear: q.gear.map((g) => ({ variant_id: g.chosenVariantId, product_name: g.productName, size: g.variants.find((x) => x.id === g.chosenVariantId)?.size ?? "" })),
    payment: total > 0 && (v.payment.method === "cash" || v.payment.method === "check")
      ? { method: v.payment.method, amount_cents: total, memo: v.payment.method === "check" && v.payment.reference ? `Check ${v.payment.reference}` : "" }
      : null,
  };

  let created: { membership_id: string; invoice_id: string | null; payment_id: string | null };
  try {
    created = (await rpc(ctx.supabase, "enroll_membership", { p: payload as unknown as Json })) as typeof created;
  } catch (err) {
    logger(ctx).error({ err: err instanceof Error ? err.message : String(err) }, "enrollment failed");
    return fail(err instanceof Error && /household|plan/.test(err.message) ? err.message : "Couldn't create the membership.");
  }

  if (needsSignature && q.contract) {
    const h = await headers();
    const { data: sig } = await ctx.supabase.from("signatures").insert({
      tenant_id: ctx.tenantId as string, template_id: q.contract.templateId, person_id: v.personId, signer_user_id: ctx.userId,
      typed_name: v.contractSignature, method: "desk", ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
    }).select("id").single();
    if (sig) await storeSignaturePdf(ctx.supabase, sig.id).catch(() => undefined); // the signature_pdfs job retries
  }

  let result: EnrollmentResult = {
    membershipId: created.membership_id,
    invoiceId: created.invoice_id,
    paymentStatus: total === 0 ? "nothing_due" : created.payment_id ? "paid" : "unpaid",
    message: total === 0 ? "Enrolled. Nothing is due today." : created.payment_id ? "Enrolled and paid." : "Enrolled. The invoice is open.",
  };

  if (cardMethod && ready && !("error" in ready) && created.invoice_id) {
    const { data: h } = await ctx.supabase.from("households").select("stripe_customer_id").eq("id", v.householdId).single();
    try {
      if (!h?.stripe_customer_id) throw new Error("This household has no Stripe customer.");
      const pi = await chargeCard(ready.stripe, ready.account, {
        tenantId: ctx.tenantId as string, householdId: v.householdId, customerId: h.stripe_customer_id, amountCents: total, currency: ctx.currency,
        paymentMethodId: cardMethod.stripeId, offSession: true, invoiceId: created.invoice_id, attemptKey: v.payment.method === "card" ? v.payment.attemptKey : "1",
        description: `Enrollment: ${q.plan.name}`, feeBps: feeBpsFromEnv(),
      });
      await rpc(ctx.supabase, "record_payment_intent", { p_pi: pi as unknown as Json });
      result = pi.status === "succeeded"
        ? { ...result, paymentStatus: "paid", message: "Enrolled and paid by card." }
        : pi.status === "processing"
          ? { ...result, paymentStatus: "pending", message: "Enrolled. The card payment is processing." }
          : { ...result, paymentStatus: "failed", message: `Enrolled, but the card was declined: ${pi.last_payment_error?.message ?? "declined"}. The invoice is open.` };
    } catch (err) {
      logger(ctx).warn({ err: err instanceof Error ? err.message : String(err) }, "enrollment card charge failed");
      result = { ...result, paymentStatus: "failed", message: `Enrolled, but the card charge failed: ${stripeErrorMessage(err)} The invoice is open.` };
    }
  }

  revalidatePath(`/desk/people/${v.personId}`);
  revalidatePath(`/desk/households/${v.householdId}`);
  revalidatePath("/desk/retail/fulfilment");
  return ok(result);
}

// ---------------------------------------------------------------------------------------------
// Gear fulfilment (retail.sell)
// ---------------------------------------------------------------------------------------------

export async function setFulfilmentStatus(input: { id: string; status: "pending" | "ready" | "delivered" }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "retail.sell", module: "retail" });
  if (denied) return denied;
  if (!["pending", "ready", "delivered"].includes(input.status)) return fail("Invalid status.");
  const delivered = input.status === "delivered";
  const { error } = await ctx.supabase.from("gear_fulfilments").update({
    status: input.status, delivered_at: delivered ? new Date().toISOString() : null, delivered_by: delivered ? ctx.userId : null,
  }).eq("id", input.id);
  if (error) return fail("Couldn't update the fulfilment.");
  revalidatePath("/desk/retail/fulfilment");
  return ok();
}

// ---------------------------------------------------------------------------------------------
// Invoices (F7.6)
// ---------------------------------------------------------------------------------------------

const dbMessage = (err: unknown, fallback: string) => (err instanceof DbError && ["22023", "P0002"].includes(err.code ?? "") ? err.message.charAt(0).toUpperCase() + err.message.slice(1) + "." : fallback);

const revalidateInvoice = (invoiceId: string, householdId?: string) => {
  revalidatePath(`/desk/billing/invoices/${invoiceId}`);
  revalidatePath("/desk/billing", "layout");
  if (householdId) revalidatePath(`/desk/households/${householdId}`);
};

const takePaymentSchema = z.discriminatedUnion("method", [
  z.object({ invoiceId: z.uuid(), method: z.literal("card"), amountCents: z.number().int().min(50), paymentMethodId: z.uuid(), attemptKey: z.uuid() }),
  z.object({ invoiceId: z.uuid(), method: z.enum(["cash", "check", "external"]), amountCents: z.number().int().positive(), memo: z.string().trim().max(200).default("") }),
]);

/** Take payment on an invoice: saved card (Stripe, off-session), cash, check or external. */
export async function takeInvoicePayment(input: z.input<typeof takePaymentSchema>): Promise<ActionResult<{ status: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = takePaymentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the payment");
  const v = parsed.data;
  const { data: inv } = await ctx.supabase.from("invoices").select("id, household_id, number, balance_cents, status").eq("id", v.invoiceId).maybeSingle();
  if (!inv) return fail("Invoice not found.");
  if (v.method !== "card") {
    try {
      await rpc(ctx.supabase, "record_manual_payment", { p_invoice_id: inv.id, p_amount_cents: v.amountCents, p_method: v.method, p_memo: v.memo });
    } catch (err) {
      return fail(dbMessage(err, "Couldn't record the payment."));
    }
    revalidateInvoice(inv.id, inv.household_id);
    return ok({ status: "succeeded" });
  }
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  const [{ data: pm }, { data: h }] = await Promise.all([
    ctx.supabase.from("payment_methods").select("stripe_payment_method_id, status").eq("id", v.paymentMethodId).eq("household_id", inv.household_id).maybeSingle(),
    ctx.supabase.from("households").select("stripe_customer_id").eq("id", inv.household_id).maybeSingle(),
  ]);
  if (!pm || pm.status !== "active" || !h?.stripe_customer_id) return fail("That card isn't available any more.");
  try {
    const pi = await chargeCard(ready.stripe, ready.account, {
      tenantId: ctx.tenantId as string, householdId: inv.household_id, customerId: h.stripe_customer_id, amountCents: v.amountCents, currency: ctx.currency,
      paymentMethodId: pm.stripe_payment_method_id, offSession: true, invoiceId: inv.id, attemptKey: v.attemptKey, description: `Invoice #${inv.number}`, feeBps: feeBpsFromEnv(),
    });
    await rpc(ctx.supabase, "record_payment_intent", { p_pi: pi as unknown as Json });
    revalidateInvoice(inv.id, inv.household_id);
    if (pi.status === "succeeded") return ok({ status: "succeeded" });
    if (pi.status === "processing") return ok({ status: "pending" });
    return fail(pi.last_payment_error?.message ?? "The card was declined.");
  } catch (err) {
    return fail(stripeErrorMessage(err));
  }
}

export async function applyCreditToInvoice(invoiceId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  if (!z.uuid().safeParse(invoiceId).success) return fail("Invalid invoice.");
  try {
    await rpc(ctx.supabase, "apply_credit", { p_invoice_id: invoiceId });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't apply credit."));
  }
  revalidateInvoice(invoiceId);
  return ok();
}

const lineSchema = z.object({
  invoiceId: z.uuid(),
  kind: z.enum(["fee", "product", "adjustment", "discount"]),
  description: z.string().trim().min(2, "Describe the line").max(200),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
  amount: z.string().trim().min(1, "Enter an amount"),
});

export async function addInvoiceLineAction(input: z.input<typeof lineSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the line", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const negative = v.amount.trim().startsWith("-");
  const cents = parseMoney(v.amount.replace(/^-/, ""));
  if (cents === null || cents === 0) return fail("Enter an amount like 25.00", { amount: "Enter an amount like 25.00" });
  const unit = v.kind === "discount" ? -cents : v.kind === "adjustment" && negative ? -cents : cents;
  try {
    await rpc(ctx.supabase, "add_invoice_line", { p_invoice_id: v.invoiceId, p_kind: v.kind, p_description: v.description, p_quantity: v.quantity, p_unit_cents: unit });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't add the line."));
  }
  revalidateInvoice(v.invoiceId);
  return ok();
}

export async function voidInvoiceAction(input: { invoiceId: string; reason: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = z.object({ invoiceId: z.uuid(), reason: z.string().trim().min(3, "Give a reason").max(200) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Give a reason");
  try {
    await rpc(ctx.supabase, "void_invoice", { p_invoice_id: parsed.data.invoiceId, p_reason: parsed.data.reason });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't void the invoice."));
  }
  revalidateInvoice(parsed.data.invoiceId);
  return ok();
}

/** Email the household's payer a receipt for the invoice's latest payment (Outbox when no provider). */
export async function emailReceipt(invoiceId: string): Promise<ActionResult<{ status: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.read", module: "billing" });
  if (denied) return denied;
  if (!z.uuid().safeParse(invoiceId).success) return fail("Invalid invoice.");
  const { data: inv } = await ctx.supabase
    .from("invoices")
    .select("id, number, balance_cents, person_id, households(primary_payer_person_id), invoice_lines(description, total_cents), payments(amount_cents, method, status, received_at)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return fail("Invoice not found.");
  const paid = (inv.payments ?? []).filter((p) => p.status === "succeeded" || p.status === "partially_refunded").sort((a, b) => b.received_at.localeCompare(a.received_at))[0];
  if (!paid) return fail("There's no payment on this invoice to send a receipt for.");
  const recipient = inv.households?.primary_payer_person_id ?? inv.person_id;
  if (!recipient) return fail("This household has no payer to send the receipt to.");
  const money = (c: number) => formatMoney(c, ctx.currency);
  const summary = await notify(ctx, {
    personIds: [recipient],
    templateKey: "payment_receipt",
    channels: ["email"],
    data: {
      invoice_number: String(inv.number), amount: money(paid.amount_cents), method: paid.method, balance: money(inv.balance_cents),
      paid_on: new Date(paid.received_at).toLocaleDateString("en-US", { timeZone: ctx.tz, dateStyle: "medium" }),
      lines: (inv.invoice_lines ?? []).map((l) => `${l.description}: ${money(l.total_cents)}`).join("\n"),
    },
    related: { type: "invoice", id: inv.id },
  });
  const status = Object.keys(summary.byStatus)[0] ?? "none";
  revalidatePath(`/desk/billing/invoices/${inv.id}`);
  if (!summary.recipients) return fail("No one in this household has an email address we can use.");
  return ok({ status });
}

/** Desk "Failed payments": retry the balance on the household's card now (after the family updates it). */
export async function retryInvoicePayment(input: { invoiceId: string; attemptKey: string }): Promise<ActionResult<{ status: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = z.object({ invoiceId: z.uuid(), attemptKey: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  try {
    const r = await chargeInvoiceWithCard(ctx.supabase, ready.stripe, { tenantId: ctx.tenantId as string, account: ready.account, currency: ctx.currency }, parsed.data.invoiceId, {
      attemptKey: `desk-retry:${parsed.data.attemptKey}`, as: "staff",
    });
    revalidateInvoice(parsed.data.invoiceId);
    revalidatePath("/desk");
    if (r.status === "succeeded" || r.status === "pending") return ok({ status: r.status });
    return fail(r.error ?? "The card was declined.");
  } catch (err) {
    return fail(stripeErrorMessage(err));
  }
}

// ---------------------------------------------------------------------------------------------
// Membership changes (Desk): holds and cancellations. The daily billing run prorates held periods and
// applies the status on the dates (billing_lifecycle).
// ---------------------------------------------------------------------------------------------

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose a date" });

export async function setMembershipHold(input: { membershipId: string; from: string; until: string; taskId?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = z.object({ membershipId: z.uuid(), from: dateStr, until: dateStr, taskId: z.uuid().optional() }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the dates");
  const v = parsed.data;
  if (v.until <= v.from) return fail("The hold must end after it starts.");
  const today = todayIn(ctx.tz);
  const { data: m, error } = await ctx.supabase.from("memberships")
    .update({ hold_from: v.from, hold_until: v.until, ...(v.from <= today ? { status: "on_hold" } : {}) })
    .eq("id", v.membershipId).in("status", ["active", "past_due", "on_hold"]).select("person_id").maybeSingle();
  if (error || !m) return fail("Only active memberships can be put on hold.");
  if (v.taskId) await ctx.supabase.from("tasks").update({ done_at: new Date().toISOString(), done_by: ctx.userId }).eq("id", v.taskId);
  revalidatePath(`/desk/people/${m.person_id}`);
  revalidatePath("/desk");
  return ok();
}

export async function endMembershipHold(membershipId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  if (!z.uuid().safeParse(membershipId).success) return fail("Invalid membership.");
  const { data: m } = await ctx.supabase.from("memberships").update({ hold_from: null, hold_until: null, status: "active" }).eq("id", membershipId).eq("status", "on_hold").select("person_id").maybeSingle();
  if (!m) {
    const { data: pending } = await ctx.supabase.from("memberships").update({ hold_from: null, hold_until: null }).eq("id", membershipId).select("person_id").maybeSingle();
    if (!pending) return fail("Couldn't change the membership.");
    revalidatePath(`/desk/people/${pending.person_id}`);
    return ok();
  }
  revalidatePath(`/desk/people/${m.person_id}`);
  return ok();
}

export async function scheduleCancellation(input: { membershipId: string; cancelAt: string; reason: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = z.object({ membershipId: z.uuid(), cancelAt: dateStr, reason: z.string().trim().min(3, "Give a reason").max(300) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details");
  const v = parsed.data;
  const today = todayIn(ctx.tz);
  const { data: m, error } = await ctx.supabase.from("memberships")
    .update({ cancel_at: v.cancelAt, cancel_reason: v.reason, ...(v.cancelAt <= today ? { status: "cancelled" } : {}) })
    .eq("id", v.membershipId).not("status", "in", "(cancelled,expired)").select("person_id").maybeSingle();
  if (error || !m) return fail("Couldn't schedule the cancellation.");
  revalidatePath(`/desk/people/${m.person_id}`);
  return ok();
}
