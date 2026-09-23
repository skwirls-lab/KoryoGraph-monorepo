"use server";

import { DbError, rpc } from "@koryo/db";
import type { Json } from "@koryo/db/types";
import {
  accountStatus,
  chargeCard,
  createConnectAccount,
  createConnectionToken,
  createSetupIntent,
  detachPaymentMethod,
  ensureCustomer,
  ensureTerminalLocation,
  feeBpsFromEnv,
  refundPayment,
  registerReader,
  retrieveSetupIntent,
} from "@koryo/payments";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx, type Ctx } from "../context";
import { authorize } from "../lib/authorize";
import { logger } from "../log";
import { NOT_CONFIGURED, onboardingLink, publishableKey, readyStripe, stripeClient, stripeErrorMessage, syncAccountStatus, tenantStripe } from "../payments/stripe";

const uuid = z.uuid();

// ---------------------------------------------------------------------------------------------
// Connect onboarding (owner: settings.manage)
// ---------------------------------------------------------------------------------------------

/** Creates the school's Stripe Standard account (once) and returns a fresh onboarding link. */
export async function startStripeOnboarding(): Promise<ActionResult<{ url: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage", module: "billing" });
  if (denied) return denied;
  const stripe = stripeClient();
  if (!stripe) return fail(NOT_CONFIGURED);
  try {
    let { accountId } = await tenantStripe(ctx);
    if (!accountId) {
      const acct = await createConnectAccount(stripe, { tenantId: ctx.tenantId as string, name: ctx.tenantName ?? "School", email: ctx.email ?? undefined });
      accountId = acct.id;
      const { error } = await ctx.supabase.from("tenants").update({ stripe_account_id: accountId, stripe_onboarding_complete: accountStatus(acct).complete }).eq("id", ctx.tenantId as string);
      if (error) return fail("Couldn't save the Stripe account.");
    }
    const url = await onboardingLink(ctx);
    return url ? ok({ url }) : fail("Couldn't create an onboarding link.");
  } catch (err) {
    logger(ctx).error({ err: err instanceof Error ? err.message : String(err) }, "stripe onboarding failed");
    return fail(stripeErrorMessage(err));
  }
}

/** Re-reads the connected account from Stripe and stores whether it can take charges. */
export async function refreshStripeStatus(): Promise<ActionResult<{ complete: boolean }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage", module: "billing" });
  if (denied) return denied;
  return syncAccountStatus(ctx);
}

// ---------------------------------------------------------------------------------------------
// Card vault (SetupIntent → Elements → finish). Staff (billing.charge) or the household's own members.
// ---------------------------------------------------------------------------------------------

async function canUseHousehold(ctx: Ctx, householdId: string): Promise<boolean> {
  if (ctx.permissions.has("billing.charge")) return true;
  const { data } = await ctx.supabase.rpc("my_household_ids");
  return Array.isArray(data) && (data as string[]).includes(householdId);
}

export async function beginCardSetup(householdId: string): Promise<ActionResult<{ clientSecret: string; publishableKey: string; stripeAccount: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { module: "billing" });
  if (denied) return denied;
  if (!uuid.safeParse(householdId).success || !(await canUseHousehold(ctx, householdId))) return fail("You don't have permission to do that.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  const pk = publishableKey();
  if (!pk) return fail("Card entry needs NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, which isn't set on this server.");
  const { data: h } = await ctx.supabase.from("households").select("id, name, billing_email, stripe_customer_id").eq("id", householdId).maybeSingle();
  if (!h) return fail("Household not found.");
  try {
    const customerId = await ensureCustomer(ready.stripe, ready.account, h.stripe_customer_id, { tenantId: ctx.tenantId as string, householdId, name: h.name, email: h.billing_email });
    if (customerId !== h.stripe_customer_id) await rpc(ctx.supabase, "set_household_stripe_customer", { p_household_id: householdId, p_customer_id: customerId });
    const si = await createSetupIntent(ready.stripe, ready.account, { customerId, tenantId: ctx.tenantId as string, householdId });
    if (!si.client_secret) return fail("Stripe didn't return a setup secret.");
    return ok({ clientSecret: si.client_secret, publishableKey: pk, stripeAccount: ready.account });
  } catch (err) {
    logger(ctx).error({ err: err instanceof Error ? err.message : String(err) }, "card setup failed");
    return fail(stripeErrorMessage(err));
  }
}

/** After Elements confirms the SetupIntent: re-read it from Stripe (never trust the browser) and vault the card. */
export async function finishCardSetup(input: { householdId: string; setupIntentId: string }): Promise<ActionResult<{ last4: string | null }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { module: "billing" });
  if (denied) return denied;
  if (!uuid.safeParse(input.householdId).success || !/^seti_\w+$/.test(input.setupIntentId)) return fail("Invalid request.");
  if (!(await canUseHousehold(ctx, input.householdId))) return fail("You don't have permission to do that.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  try {
    const si = await retrieveSetupIntent(ready.stripe, ready.account, input.setupIntentId);
    if (si.metadata?.household_id !== input.householdId) return fail("That card setup belongs to a different household.");
    if (si.status !== "succeeded" || !si.payment_method || typeof si.payment_method === "string") return fail("The card wasn't saved. Please try again.");
    const pm = { ...si.payment_method, customer: si.payment_method.customer ?? si.customer };
    await rpc(ctx.supabase, "record_payment_method", { p_household_id: input.householdId, p_pm: pm as unknown as Json });
    revalidatePath(`/desk/households/${input.householdId}`);
    revalidatePath("/home/billing");
    return ok({ last4: si.payment_method.card?.last4 ?? null });
  } catch (err) {
    logger(ctx).error({ err: err instanceof Error ? err.message : String(err) }, "finishing card setup failed");
    return fail(stripeErrorMessage(err));
  }
}

export async function setDefaultCard(paymentMethodId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { module: "billing" });
  if (denied) return denied;
  if (!uuid.safeParse(paymentMethodId).success) return fail("Invalid card.");
  try {
    await rpc(ctx.supabase, "set_default_payment_method", { p_payment_method_id: paymentMethodId });
  } catch {
    return fail("Couldn't change the default card.");
  }
  revalidatePath("/desk/households/[id]", "page");
  revalidatePath("/home/billing");
  return ok();
}

export async function removeCard(paymentMethodId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  if (!uuid.safeParse(paymentMethodId).success) return fail("Invalid card.");
  const { data: pm } = await ctx.supabase.from("payment_methods").select("id, household_id, stripe_payment_method_id").eq("id", paymentMethodId).maybeSingle();
  if (!pm) return fail("Card not found.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  try {
    await detachPaymentMethod(ready.stripe, ready.account, pm.stripe_payment_method_id);
  } catch (err) {
    return fail(stripeErrorMessage(err));
  }
  await rpc(ctx.supabase, "mark_payment_method_detached", { p_payment_method_id: pm.id });
  revalidatePath(`/desk/households/${pm.household_id}`);
  return ok();
}

// ---------------------------------------------------------------------------------------------
// Charging a saved card (staff; the customer isn't present → off-session)
// ---------------------------------------------------------------------------------------------

const chargeSchema = z.object({
  householdId: z.uuid(),
  paymentMethodId: z.uuid(),
  amountCents: z.number().int().min(50, "Card charges must be at least $0.50").max(10_000_00, "That's more than $10,000"),
  invoiceId: z.uuid().nullish(),
  memo: z.string().trim().max(200).optional(),
  /** Generated when the dialog opens; a double-submit reuses it so Stripe charges once. */
  attemptKey: z.uuid(),
});

export async function chargeSavedCard(input: z.input<typeof chargeSchema>): Promise<ActionResult<{ paymentId: string; status: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.charge", module: "billing" });
  if (denied) return denied;
  const parsed = chargeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the amount");
  const v = parsed.data;
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  const [{ data: pm }, { data: h }] = await Promise.all([
    ctx.supabase.from("payment_methods").select("stripe_payment_method_id, status").eq("id", v.paymentMethodId).eq("household_id", v.householdId).maybeSingle(),
    ctx.supabase.from("households").select("stripe_customer_id").eq("id", v.householdId).maybeSingle(),
  ]);
  if (!pm || pm.status !== "active") return fail("That card isn't available any more.");
  if (!h?.stripe_customer_id) return fail("This household has no Stripe customer yet — add a card first.");
  let pi;
  try {
    pi = await chargeCard(ready.stripe, ready.account, {
      tenantId: ctx.tenantId as string, householdId: v.householdId, customerId: h.stripe_customer_id, amountCents: v.amountCents,
      currency: ctx.currency, paymentMethodId: pm.stripe_payment_method_id, offSession: true, invoiceId: v.invoiceId ?? null,
      attemptKey: v.attemptKey, description: v.memo || undefined, feeBps: feeBpsFromEnv(),
    });
  } catch (err) {
    logger(ctx).error({ err: err instanceof Error ? err.message : String(err) }, "charge failed");
    return fail(stripeErrorMessage(err));
  }
  // Record what Stripe says right away (the webhook later confirms the same intent idempotently).
  const paymentId = await rpc(ctx.supabase, "record_payment_intent", { p_pi: pi as unknown as Json });
  revalidatePath(`/desk/households/${v.householdId}`);
  if (pi.status === "succeeded") return ok({ paymentId, status: "succeeded" });
  if (pi.status === "processing") return ok({ paymentId, status: "pending" });
  return fail(pi.last_payment_error?.message ?? "The card was declined.");
}

// ---------------------------------------------------------------------------------------------
// Refunds (billing.refund). Card payments are refunded at Stripe first, then recorded.
// ---------------------------------------------------------------------------------------------

const refundSchema = z.object({
  paymentId: z.uuid(),
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(2, "Give a reason").max(200),
  /** true = issue account credit (a credit note) instead of returning the money. */
  asCredit: z.boolean().default(false),
});

export async function refundPaymentAction(input: z.input<typeof refundSchema>): Promise<ActionResult<{ refundId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "billing.refund", module: "billing" });
  if (denied) return denied;
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the refund");
  const v = parsed.data;
  const { data: p } = await ctx.supabase.from("payments").select("id, household_id, amount_cents, refunded_cents, status, stripe_payment_intent_id").eq("id", v.paymentId).maybeSingle();
  if (!p) return fail("Payment not found.");
  if (v.amountCents > p.amount_cents - p.refunded_cents) return fail(`You can refund at most ${((p.amount_cents - p.refunded_cents) / 100).toFixed(2)}.`);
  let stripeRefundId: string | null = null;
  if (p.stripe_payment_intent_id && !v.asCredit) {
    const ready = await readyStripe(ctx);
    if ("error" in ready) return fail(ready.error);
    try {
      const r = await refundPayment(ready.stripe, ready.account, { paymentIntentId: p.stripe_payment_intent_id, amountCents: v.amountCents, refundKey: `${p.id}:${p.refunded_cents}:${v.amountCents}` });
      if (r.status === "failed" || r.status === "canceled") return fail("Stripe declined the refund.");
      stripeRefundId = r.id;
    } catch (err) {
      return fail(stripeErrorMessage(err));
    }
  }
  try {
    const refundId = await rpc(ctx.supabase, "record_refund", { p_payment_id: p.id, p_amount_cents: v.amountCents, p_reason: v.reason, p_stripe_refund_id: stripeRefundId ?? undefined, p_as_credit: v.asCredit });
    revalidatePath(`/desk/households/${p.household_id}`);
    revalidatePath("/desk/billing", "layout");
    return ok({ refundId });
  } catch (err) {
    if (!stripeRefundId) return fail(err instanceof DbError && err.code === "22023" ? err.message : "Couldn't record the refund.");
    logger(ctx).error({ err: err instanceof Error ? err.message : String(err), stripe_refund: stripeRefundId }, "refund recorded at Stripe but not in the ledger; the charge.refunded webhook will reconcile it");
    return fail("The refund went through at Stripe but couldn't be recorded yet; it will appear once Stripe confirms it.");
  }
}

// ---------------------------------------------------------------------------------------------
// Stripe Terminal
// ---------------------------------------------------------------------------------------------

export async function terminalConnectionToken(): Promise<ActionResult<{ secret: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: ctx.permissions.has("retail.sell") ? "retail.sell" : "billing.charge" });
  if (denied) return denied;
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  try {
    return ok({ secret: await createConnectionToken(ready.stripe, ready.account, ready.tenant.terminalLocationId ?? undefined) });
  } catch (err) {
    return fail(stripeErrorMessage(err));
  }
}

const readerSchema = z.object({ registrationCode: z.string().trim().min(3).max(60), label: z.string().trim().min(2).max(60) });

/** Registers a card reader (in test mode the code `simulated-wpe` gives Stripe's simulated WisePOS E). */
export async function registerCardReader(input: z.input<typeof readerSchema>): Promise<ActionResult<{ readerId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage" });
  if (denied) return denied;
  const parsed = readerSchema.safeParse(input);
  if (!parsed.success) return fail("Enter the registration code shown on the reader and a label.");
  const ready = await readyStripe(ctx);
  if ("error" in ready) return fail(ready.error);
  const { data: loc } = await ctx.supabase.from("locations").select("name, address").eq("is_default", true).maybeSingle();
  const a = (loc?.address ?? {}) as Record<string, string | undefined>;
  if (!a.line1 || !a.city || !a.postal_code) return fail("Add your school's street address to its location first; Stripe needs it for card readers.");
  try {
    const locationId = await ensureTerminalLocation(ready.stripe, ready.account, ready.tenant.terminalLocationId, {
      tenantId: ctx.tenantId as string, name: loc?.name ?? ctx.tenantName ?? "School",
      address: { line1: a.line1, city: a.city, state: a.region ?? a.state, postal_code: a.postal_code, country: a.country ?? "US" },
    });
    if (locationId !== ready.tenant.terminalLocationId) {
      const settings = { ...ready.tenant.settings, stripe: { ...((ready.tenant.settings.stripe ?? {}) as object), terminal_location_id: locationId } };
      await ctx.supabase.from("tenants").update({ settings: settings as Json }).eq("id", ctx.tenantId as string);
    }
    const reader = await registerReader(ready.stripe, ready.account, { registrationCode: parsed.data.registrationCode, label: parsed.data.label, locationId });
    const { data: defaultLoc } = await ctx.supabase.from("locations").select("id").eq("is_default", true).maybeSingle();
    await ctx.supabase.from("terminal_readers").upsert({ tenant_id: ctx.tenantId as string, stripe_reader_id: reader.id, label: parsed.data.label, location_id: defaultLoc?.id ?? null }, { onConflict: "tenant_id,stripe_reader_id" });
    revalidatePath("/desk/settings/payments");
    return ok({ readerId: reader.id });
  } catch (err) {
    return fail(stripeErrorMessage(err));
  }
}
