"use server";

import { rpc } from "@koryo/db";
import type { Json } from "@koryo/db/types";
import { chargeCard, feeBpsFromEnv } from "@koryo/payments";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney } from "@/lib/curriculum";
import { enrollmentQuoteSchema, enrollmentSchema, planSchema, type EnrollmentInput, type EnrollmentQuoteInput, type PlanInput } from "@/lib/validation/billing";
import { quoteEnrollment, type EnrollmentQuote } from "../billing/enrollment";
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
