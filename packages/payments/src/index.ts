import Stripe from "stripe";

export { Stripe };
export type StripeClient = Stripe;

/**
 * Platform-level Stripe. Every tenant-scoped call passes `stripeAccount` (the tenant's Connect Standard
 * account) so money moves on the school's own account; the platform only takes the configured fee.
 */
export type StripeEnv = Readonly<Record<string, string | undefined>>;

/** Any test-looking key satisfies stripe-mock; it never reaches Stripe. */
export const STRIPE_MOCK_API_KEY = "sk_test_123";

export function isMock(env: StripeEnv = process.env): boolean {
  return env.STRIPE_MOCK === "1" || env.STRIPE_MOCK === "true";
}

/** Server-side Stripe calls are possible (real key, or stripe-mock for tests). */
export function stripeConfigured(env: StripeEnv = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY) || isMock(env);
}

/** Card entry in the browser needs a publishable key too; stripe-mock can't serve Elements. */
export function elementsConfigured(env: StripeEnv = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

export function createStripe(opts: { secretKey?: string; mock?: boolean; mockHost?: string; mockPort?: number } = {}): Stripe {
  if (opts.mock) {
    return new Stripe(opts.secretKey || STRIPE_MOCK_API_KEY, {
      host: opts.mockHost ?? "localhost",
      port: opts.mockPort ?? 12111,
      protocol: "http",
      maxNetworkRetries: 0,
      telemetry: false,
    });
  }
  if (!opts.secretKey) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(opts.secretKey, { maxNetworkRetries: 2, telemetry: false, appInfo: { name: "KoryoGraph" } });
}

/** The configured client, or null when Stripe isn't set up (callers show that honestly). */
export function stripeFromEnv(env: StripeEnv = process.env): Stripe | null {
  if (!stripeConfigured(env)) return null;
  return createStripe({
    secretKey: env.STRIPE_SECRET_KEY,
    mock: isMock(env) && !env.STRIPE_SECRET_KEY,
    mockHost: env.STRIPE_MOCK_HOST,
    mockPort: env.STRIPE_MOCK_PORT ? Number(env.STRIPE_MOCK_PORT) : undefined,
  });
}

/** Platform fee in cents from basis points (rounded half up, never more than the amount). */
export function platformFeeCents(amountCents: number, bps: number): number {
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.min(amountCents, Math.floor((amountCents * bps + 5000) / 10000));
}

export function feeBpsFromEnv(env: StripeEnv = process.env): number {
  const n = Number(env.STRIPE_PLATFORM_FEE_BPS ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ---------------------------------------------------------------------------------------------
// Connect Standard onboarding
// ---------------------------------------------------------------------------------------------

export async function createConnectAccount(stripe: Stripe, input: { tenantId: string; name: string; email?: string; country?: string }): Promise<Stripe.Account> {
  return stripe.accounts.create(
    {
      type: "standard",
      country: input.country ?? "US",
      email: input.email,
      business_profile: { name: input.name },
      metadata: { tenant_id: input.tenantId },
    },
    { idempotencyKey: `connect-account:${input.tenantId}` },
  );
}

export async function createAccountLink(stripe: Stripe, accountId: string, urls: { refreshUrl: string; returnUrl: string }): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({ account: accountId, refresh_url: urls.refreshUrl, return_url: urls.returnUrl, type: "account_onboarding" });
}

export interface AccountStatus {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  complete: boolean;
}

export function accountStatus(account: Pick<Stripe.Account, "charges_enabled" | "details_submitted" | "payouts_enabled">): AccountStatus {
  const chargesEnabled = Boolean(account.charges_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  return { chargesEnabled, detailsSubmitted, payoutsEnabled: Boolean(account.payouts_enabled), complete: chargesEnabled && detailsSubmitted };
}

export async function retrieveAccount(stripe: Stripe, accountId: string): Promise<Stripe.Account> {
  return stripe.accounts.retrieve(accountId);
}

// ---------------------------------------------------------------------------------------------
// Customers, vaulting, charging, refunds (all on the tenant's connected account)
// ---------------------------------------------------------------------------------------------

export interface HouseholdCustomer {
  tenantId: string;
  householdId: string;
  name: string;
  email?: string | null;
}

/** Returns the household's Customer id, creating one (idempotently per household) when missing. */
export async function ensureCustomer(stripe: Stripe, account: string, existingId: string | null | undefined, h: HouseholdCustomer): Promise<string> {
  if (existingId) return existingId;
  const customer = await stripe.customers.create(
    { name: h.name, email: h.email ?? undefined, metadata: { tenant_id: h.tenantId, household_id: h.householdId } },
    { stripeAccount: account, idempotencyKey: `customer:${h.householdId}` },
  );
  return customer.id;
}

export async function createSetupIntent(stripe: Stripe, account: string, input: { customerId: string; tenantId: string; householdId: string }): Promise<Stripe.SetupIntent> {
  return stripe.setupIntents.create(
    {
      customer: input.customerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: { tenant_id: input.tenantId, household_id: input.householdId },
    },
    { stripeAccount: account },
  );
}

export async function retrieveSetupIntent(stripe: Stripe, account: string, id: string): Promise<Stripe.SetupIntent> {
  return stripe.setupIntents.retrieve(id, { expand: ["payment_method"] }, { stripeAccount: account });
}

export interface ChargeInput {
  tenantId: string;
  householdId: string;
  /** The household's Customer; optional for card-present (Terminal) charges. */
  customerId?: string;
  amountCents: number;
  currency: string;
  /** Saved card to charge; omit for an on-session charge confirmed in the browser. */
  paymentMethodId?: string;
  /** true when the customer isn't present (autopay, staff charging a card on file). */
  offSession: boolean;
  invoiceId?: string | null;
  /** Distinguishes retries of the same invoice; the idempotency key is per (invoice|ref, attempt). */
  attemptKey: string;
  method?: "card" | "terminal";
  description?: string;
  feeBps?: number;
}

export function chargeIdempotencyKey(input: Pick<ChargeInput, "invoiceId" | "householdId" | "attemptKey">): string {
  return input.invoiceId ? `charge:invoice:${input.invoiceId}:${input.attemptKey}` : `charge:household:${input.householdId}:${input.attemptKey}`;
}

/**
 * Creates (and, for a saved card, confirms) a PaymentIntent. Card declines surface as a returned intent
 * with `last_payment_error`, not an exception, so the caller always gets something to record.
 */
export async function chargeCard(stripe: Stripe, account: string, input: ChargeInput): Promise<Stripe.PaymentIntent> {
  if (!Number.isInteger(input.amountCents) || input.amountCents < 50) throw new Error("Stripe charges must be at least 50 cents");
  const fee = platformFeeCents(input.amountCents, input.feeBps ?? 0);
  const metadata: Record<string, string> = { tenant_id: input.tenantId, household_id: input.householdId, method: input.method ?? "card" };
  if (input.invoiceId) metadata.invoice_id = input.invoiceId;
  const params: Stripe.PaymentIntentCreateParams = {
    amount: input.amountCents,
    currency: input.currency.toLowerCase(),
    ...(input.customerId ? { customer: input.customerId } : {}),
    description: input.description,
    metadata,
    ...(fee > 0 ? { application_fee_amount: fee } : {}),
  };
  if (input.method === "terminal") {
    params.payment_method_types = ["card_present"];
    params.capture_method = "automatic";
  } else if (input.paymentMethodId) {
    params.payment_method = input.paymentMethodId;
    params.confirm = true;
    params.off_session = input.offSession;
    params.payment_method_types = ["card"];
  } else {
    params.payment_method_types = ["card"];
    params.setup_future_usage = "off_session";
  }
  const opts = { stripeAccount: account, idempotencyKey: chargeIdempotencyKey(input) };
  try {
    return await stripe.paymentIntents.create(params, opts);
  } catch (err) {
    // A decline on confirm throws a StripeCardError that carries the failed intent.
    const pi = (err as { raw?: { payment_intent?: Stripe.PaymentIntent } }).raw?.payment_intent;
    if (err instanceof Stripe.errors.StripeCardError && pi) return pi;
    throw err;
  }
}

export async function retrievePaymentIntent(stripe: Stripe, account: string, id: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(id, {}, { stripeAccount: account });
}

export async function refundPayment(stripe: Stripe, account: string, input: { paymentIntentId: string; amountCents: number; refundKey: string; reason?: Stripe.RefundCreateParams.Reason }): Promise<Stripe.Refund> {
  return stripe.refunds.create(
    { payment_intent: input.paymentIntentId, amount: input.amountCents, reason: input.reason, refund_application_fee: true },
    { stripeAccount: account, idempotencyKey: `refund:${input.refundKey}` },
  );
}

export async function detachPaymentMethod(stripe: Stripe, account: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.detach(paymentMethodId, {}, { stripeAccount: account });
}

// ---------------------------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------------------------

export async function ensureTerminalLocation(stripe: Stripe, account: string, existingId: string | null | undefined, input: { tenantId: string; name: string; address: Stripe.Terminal.LocationCreateParams.Address }): Promise<string> {
  if (existingId) return existingId;
  const loc = await stripe.terminal.locations.create(
    { display_name: input.name, address: input.address, metadata: { tenant_id: input.tenantId } },
    { stripeAccount: account, idempotencyKey: `terminal-location:${input.tenantId}` },
  );
  return loc.id;
}

export async function createConnectionToken(stripe: Stripe, account: string, locationId?: string): Promise<string> {
  const token = await stripe.terminal.connectionTokens.create(locationId ? { location: locationId } : {}, { stripeAccount: account });
  return token.secret;
}

/** In test mode the registration code `simulated-wpe` registers Stripe's simulated WisePOS E. */
export async function registerReader(stripe: Stripe, account: string, input: { registrationCode: string; label: string; locationId: string }): Promise<Stripe.Terminal.Reader> {
  return stripe.terminal.readers.create({ registration_code: input.registrationCode, label: input.label, location: input.locationId }, { stripeAccount: account });
}

export async function listReaders(stripe: Stripe, account: string, locationId?: string): Promise<Stripe.Terminal.Reader[]> {
  const res = await stripe.terminal.readers.list({ limit: 50, ...(locationId ? { location: locationId } : {}) }, { stripeAccount: account });
  return res.data;
}

/**
 * Sends a card_present PaymentIntent to a reader. In test mode `simulate` presents Stripe's test card on
 * the simulated reader; then waits (briefly) for the intent to settle and returns it.
 */
export async function collectOnReader(stripe: Stripe, account: string, input: { readerId: string; paymentIntentId: string; simulate: boolean; timeoutMs?: number }): Promise<Stripe.PaymentIntent> {
  await stripe.terminal.readers.processPaymentIntent(input.readerId, { payment_intent: input.paymentIntentId }, { stripeAccount: account });
  if (input.simulate) await stripe.testHelpers.terminal.readers.presentPaymentMethod(input.readerId, {}, { stripeAccount: account });
  const deadline = Date.now() + (input.timeoutMs ?? 20_000);
  for (;;) {
    const pi = await stripe.paymentIntents.retrieve(input.paymentIntentId, {}, { stripeAccount: account });
    if (pi.status === "requires_capture") return stripe.paymentIntents.capture(pi.id, {}, { stripeAccount: account });
    if (pi.status !== "requires_payment_method" && pi.status !== "processing") return pi;
    if (pi.last_payment_error || Date.now() > deadline) return pi;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// ---------------------------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------------------------

/** Verifies the `Stripe-Signature` header over the raw body; throws on a bad or stale signature. */
export function verifyWebhook(stripe: Stripe, rawBody: string, signature: string | null, secret: string): Stripe.Event {
  if (!signature) throw new Error("missing Stripe-Signature header");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Signs a payload the way Stripe does — for tests and fixtures only. */
export function signTestPayload(stripe: Stripe, payload: string, secret: string): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret });
}

/** The event types the webhook acts on (F7.8); anything else is recorded and acknowledged. */
export const HANDLED_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.canceled",
  "setup_intent.succeeded",
  "setup_intent.setup_failed",
  "payment_method.attached",
  "payment_method.detached",
  "payment_method.updated",
  "charge.refunded",
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "account.updated",
] as const;
export type HandledEvent = (typeof HANDLED_EVENTS)[number];

export function isHandledEvent(type: string): type is HandledEvent {
  return (HANDLED_EVENTS as readonly string[]).includes(type);
}
