import "server-only";
import { accountStatus, createAccountLink, elementsConfigured, retrieveAccount, stripeFromEnv, type Stripe } from "@koryo/payments";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Ctx } from "../context";

export const NOT_CONFIGURED = "Stripe isn't configured on this server yet (STRIPE_SECRET_KEY is not set), so card payments are unavailable. Cash, check and external payments still work.";
export const NOT_CONNECTED = "This school hasn't finished connecting its Stripe account. An owner can do that in Settings → Payments.";

export interface TenantStripe {
  accountId: string | null;
  onboardingComplete: boolean;
  terminalLocationId: string | null;
  settings: Record<string, unknown>;
}

export function stripeClient(): Stripe | null {
  return stripeFromEnv();
}

/** Browser card entry needs a real key pair; stripe-mock (tests) cannot serve Elements. */
export function publishableKey(): string | null {
  return elementsConfigured() ? (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null) : null;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

export async function tenantStripe(ctx: Ctx): Promise<TenantStripe> {
  const { data } = await ctx.supabase.from("tenants").select("stripe_account_id, stripe_onboarding_complete, settings").eq("id", ctx.tenantId as string).single();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const stripeSettings = (settings.stripe ?? {}) as { terminal_location_id?: string };
  return {
    accountId: data?.stripe_account_id ?? null,
    onboardingComplete: Boolean(data?.stripe_onboarding_complete),
    terminalLocationId: stripeSettings.terminal_location_id ?? null,
    settings,
  };
}

/** The Stripe client plus a connected, onboarded account — or a human-readable reason there isn't one. */
export async function readyStripe(ctx: Ctx): Promise<{ stripe: Stripe; account: string; tenant: TenantStripe } | { error: string }> {
  const stripe = stripeClient();
  if (!stripe) return { error: NOT_CONFIGURED };
  const tenant = await tenantStripe(ctx);
  if (!tenant.accountId || !tenant.onboardingComplete) return { error: NOT_CONNECTED };
  return { stripe, account: tenant.accountId, tenant };
}

export function stripeErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    const e = err as { type?: string; message: string };
    if (e.type === "StripeCardError" || e.type === "StripeInvalidRequestError") return e.message;
  }
  return "Stripe couldn't complete that request. Try again in a moment.";
}

/** Re-reads the connected account from Stripe and stores whether it can take charges (caller authorises). */
export async function syncAccountStatus(ctx: Ctx): Promise<ActionResult<{ complete: boolean }>> {
  const stripe = stripeClient();
  if (!stripe) return fail(NOT_CONFIGURED);
  const { accountId } = await tenantStripe(ctx);
  if (!accountId) return fail("No Stripe account is connected yet.");
  try {
    const s = accountStatus(await retrieveAccount(stripe, accountId));
    await ctx.supabase.from("tenants").update({ stripe_onboarding_complete: s.complete }).eq("id", ctx.tenantId as string);
    revalidatePath("/desk/settings/payments");
    return ok({ complete: s.complete });
  } catch (err) {
    return fail(stripeErrorMessage(err));
  }
}

/** A fresh onboarding link for an existing connected account (links are single-use and expire). */
export async function onboardingLink(ctx: Ctx): Promise<string | null> {
  const stripe = stripeClient();
  const { accountId } = await tenantStripe(ctx);
  if (!stripe || !accountId) return null;
  const link = await createAccountLink(stripe, accountId, {
    refreshUrl: `${appUrl()}/desk/settings/payments/refresh`,
    returnUrl: `${appUrl()}/desk/settings/payments/return`,
  });
  return link.url;
}
