"use server";

import { rpc } from "@koryo/db";
import { chargeCard, detachPaymentMethod, ensureCustomer, feeBpsFromEnv } from "@koryo/payments";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx, type Ctx } from "../context";
import { authorize } from "../lib/authorize";
import { logger } from "../log";
import { publishableKey, readyStripe, stripeErrorMessage } from "../payments/stripe";

const uuid = z.uuid();

async function mine(ctx: Ctx, householdId: string): Promise<boolean> {
  if (ctx.permissions.has("billing.charge")) return true;
  const { data } = await ctx.supabase.rpc("my_household_ids");
  return Array.isArray(data) && (data as string[]).includes(householdId);
}

/**
 * Home "Pay now": an on-session PaymentIntent for the invoice balance, confirmed in the browser with
 * Elements. The ledger is updated only from Stripe's signed webhook (payment_intent.succeeded), never
 * from the browser — so the page shows "processing" until Stripe confirms.
 */
export async function startInvoicePayment(input: { invoiceId: string; attemptKey: string }): Promise<ActionResult<{ clientSecret: string; publishableKey: string; stripeAccount: string; amountCents: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { module: "billing" });
  if (denied) return denied;
  if (!uuid.safeParse(input.invoiceId).success || !uuid.safeParse(input.attemptKey).success) return fail("Invalid request.");
  const { data: inv } = await ctx.supabase.from("invoices").select("id, number, household_id, balance_cents, status").eq("id", input.invoiceId).maybeSingle();
  if (!inv || !(await mine(ctx, inv.household_id))) return fail("Invoice not found.");
  if (!["open", "partially_paid", "past_due"].includes(inv.status) || inv.balance_cents <= 0) return fail("This invoice has nothing left to pay.");
  if (inv.balance_cents < 50) return fail("Balances under $0.50 can't be paid by card; please pay at the front desk.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail("Online card payments aren't available yet. You can pay at the front desk.");
  const pk = publishableKey();
  if (!pk) return fail("Online card payments aren't available yet. You can pay at the front desk.");
  const { data: h } = await ctx.supabase.from("households").select("id, name, billing_email, stripe_customer_id").eq("id", inv.household_id).maybeSingle();
  if (!h) return fail("Household not found.");
  try {
    const customerId = await ensureCustomer(ready.stripe, ready.account, h.stripe_customer_id, { tenantId: ctx.tenantId as string, householdId: h.id, name: h.name, email: h.billing_email });
    if (customerId !== h.stripe_customer_id) await rpc(ctx.supabase, "set_household_stripe_customer", { p_household_id: h.id, p_customer_id: customerId });
    const pi = await chargeCard(ready.stripe, ready.account, {
      tenantId: ctx.tenantId as string, householdId: h.id, customerId, amountCents: inv.balance_cents, currency: ctx.currency,
      offSession: false, invoiceId: inv.id, attemptKey: `home:${input.attemptKey}`, description: `Invoice #${inv.number}`, feeBps: feeBpsFromEnv(),
    });
    if (!pi.client_secret) return fail("Stripe didn't return a payment secret.");
    return ok({ clientSecret: pi.client_secret, publishableKey: pk, stripeAccount: ready.account, amountCents: inv.balance_cents });
  } catch (err) {
    logger(ctx).error({ err: err instanceof Error ? err.message : String(err) }, "home payment start failed");
    return fail(stripeErrorMessage(err));
  }
}

export async function removeMyCard(paymentMethodId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { module: "billing" });
  if (denied) return denied;
  if (!uuid.safeParse(paymentMethodId).success) return fail("Invalid card.");
  const { data: pm } = await ctx.supabase.from("payment_methods").select("id, household_id, stripe_payment_method_id").eq("id", paymentMethodId).eq("status", "active").maybeSingle();
  if (!pm || !(await mine(ctx, pm.household_id))) return fail("Card not found.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  try {
    await detachPaymentMethod(ready.stripe, ready.account, pm.stripe_payment_method_id);
    await rpc(ctx.supabase, "mark_payment_method_detached", { p_payment_method_id: pm.id });
  } catch (err) {
    return fail(stripeErrorMessage(err));
  }
  revalidatePath("/home/billing");
  revalidatePath(`/desk/households/${pm.household_id}`);
  return ok();
}

export async function setAutopay(input: { membershipId: string; enabled: boolean }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { module: "billing" });
  if (denied) return denied;
  if (!uuid.safeParse(input.membershipId).success) return fail("Invalid membership.");
  try {
    await rpc(ctx.supabase, "set_membership_autopay", { p_membership_id: input.membershipId, p_enabled: input.enabled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return fail(/add a card/.test(msg) ? "Add a card before turning on autopay." : "Couldn't change autopay.");
  }
  revalidatePath("/home/billing");
  return ok();
}

const holdSchema = z.object({
  membershipId: z.uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose a start date" }),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose an end date" }),
  reason: z.string().trim().max(500).default(""),
});

/** Home: ask the school to pause a membership. Creates a task for staff; nothing changes until they apply it. */
export async function requestHold(input: z.input<typeof holdSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { module: "billing" });
  if (denied) return denied;
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the dates");
  const v = parsed.data;
  try {
    await rpc(ctx.supabase, "request_membership_hold", { p_membership_id: v.membershipId, p_from: v.from, p_until: v.until, p_reason: v.reason });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return fail(/choose a start|180 days/.test(msg) ? msg.charAt(0).toUpperCase() + msg.slice(1) + "." : "Couldn't send the request.");
  }
  revalidatePath("/home/billing");
  return ok();
}
