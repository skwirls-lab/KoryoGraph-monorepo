import { beforeAll, describe, expect, it } from "vitest";
import {
  accountStatus,
  chargeCard,
  chargeIdempotencyKey,
  collectOnReader,
  createAccountLink,
  createConnectAccount,
  createConnectionToken,
  createSetupIntent,
  createStripe,
  elementsConfigured,
  ensureCustomer,
  ensureTerminalLocation,
  isHandledEvent,
  listReaders,
  platformFeeCents,
  refundPayment,
  registerReader,
  signTestPayload,
  stripeConfigured,
  stripeFromEnv,
  verifyWebhook,
} from "./index";

// Runs against stripe-mock (docker: `npm run stripe:mock`), never the real API.
const stripe = createStripe({ mock: true, mockHost: process.env.STRIPE_MOCK_HOST, mockPort: process.env.STRIPE_MOCK_PORT ? Number(process.env.STRIPE_MOCK_PORT) : undefined });
const ACCOUNT = "acct_1TestSchool";

beforeAll(async () => {
  const port = process.env.STRIPE_MOCK_PORT ?? "12111";
  const res = await fetch(`http://${process.env.STRIPE_MOCK_HOST ?? "localhost"}:${port}/v1/balance`, { headers: { authorization: "Bearer sk_test_x" } }).catch(() => null);
  if (!res?.ok) throw new Error(`stripe-mock is not reachable on :${port} — start it with \`npm run stripe:mock\``);
});

describe("configuration", () => {
  it("is honest about missing keys", () => {
    expect(stripeConfigured({})).toBe(false);
    expect(stripeFromEnv({})).toBeNull();
    expect(stripeConfigured({ STRIPE_MOCK: "1" })).toBe(true);
    expect(stripeConfigured({ STRIPE_SECRET_KEY: "sk_test_1" })).toBe(true);
    expect(elementsConfigured({ STRIPE_SECRET_KEY: "sk_test_1" })).toBe(false);
    expect(elementsConfigured({ STRIPE_SECRET_KEY: "sk_test_1", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_1" })).toBe(true);
    expect(() => createStripe({})).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("computes the platform fee in basis points", () => {
    expect(platformFeeCents(10000, 0)).toBe(0);
    expect(platformFeeCents(10000, 250)).toBe(250);
    expect(platformFeeCents(999, 150)).toBe(15); // 14.985 → 15
    expect(platformFeeCents(100, 20000)).toBe(100);
    expect(platformFeeCents(100, Number.NaN)).toBe(0);
  });

  it("keys charges by invoice attempt so retries never double-charge", () => {
    expect(chargeIdempotencyKey({ invoiceId: "inv", householdId: "h", attemptKey: "1" })).toBe("charge:invoice:inv:1");
    expect(chargeIdempotencyKey({ invoiceId: null, householdId: "h", attemptKey: "x" })).toBe("charge:household:h:x");
  });
});

describe("Connect onboarding (stripe-mock)", () => {
  it("creates a Standard account and an onboarding link", async () => {
    const acct = await createConnectAccount(stripe, { tenantId: "t1", name: "Ridgeline TKD", email: "owner@example.com" });
    expect(acct.id).toMatch(/^acct_/);
    const link = await createAccountLink(stripe, acct.id, { refreshUrl: "http://localhost/refresh", returnUrl: "http://localhost/return" });
    expect(link.url).toMatch(/^https?:\/\//);
  });

  it("derives onboarding completeness", () => {
    expect(accountStatus({ charges_enabled: true, details_submitted: true, payouts_enabled: false }).complete).toBe(true);
    expect(accountStatus({ charges_enabled: false, details_submitted: true, payouts_enabled: false }).complete).toBe(false);
  });
});

describe("customers, vaulting, charges and refunds (stripe-mock)", () => {
  it("reuses an existing customer and creates one when missing", async () => {
    expect(await ensureCustomer(stripe, ACCOUNT, "cus_existing", { tenantId: "t", householdId: "h", name: "Cooper" })).toBe("cus_existing");
    const id = await ensureCustomer(stripe, ACCOUNT, null, { tenantId: "t", householdId: "h", name: "Cooper", email: "c@example.com" });
    expect(id).toMatch(/^cus_/);
  });

  it("creates an off-session SetupIntent", async () => {
    const si = await createSetupIntent(stripe, ACCOUNT, { customerId: "cus_1", tenantId: "t", householdId: "h" });
    expect(si.id).toMatch(/^seti_/);
    expect(si.client_secret).toBeTruthy();
  });

  it("charges a saved card off-session and an on-session intent", async () => {
    const off = await chargeCard(stripe, ACCOUNT, { tenantId: "t", householdId: "h", customerId: "cus_1", amountCents: 100, currency: "USD", paymentMethodId: "pm_card_visa", offSession: true, invoiceId: "inv1", attemptKey: "1", feeBps: 100 });
    expect(off.id).toMatch(/^pi_/);
    const on = await chargeCard(stripe, ACCOUNT, { tenantId: "t", householdId: "h", customerId: "cus_1", amountCents: 2500, currency: "usd", offSession: false, attemptKey: "a" });
    expect(on.client_secret).toBeTruthy();
    const terminal = await chargeCard(stripe, ACCOUNT, { tenantId: "t", householdId: "h", customerId: "cus_1", amountCents: 900, currency: "usd", offSession: false, attemptKey: "b", method: "terminal" });
    expect(terminal.id).toMatch(/^pi_/);
  });

  it("refuses charges below Stripe's minimum", async () => {
    await expect(chargeCard(stripe, ACCOUNT, { tenantId: "t", householdId: "h", customerId: "c", amountCents: 10, currency: "usd", offSession: true, attemptKey: "1" })).rejects.toThrow(/50 cents/);
  });

  it("refunds a payment", async () => {
    const r = await refundPayment(stripe, ACCOUNT, { paymentIntentId: "pi_123", amountCents: 50, refundKey: "p1:1" });
    expect(r.id).toMatch(/^re_/);
  });
});

describe("Terminal (stripe-mock)", () => {
  it("creates a location, a connection token and registers a reader", async () => {
    const loc = await ensureTerminalLocation(stripe, ACCOUNT, null, { tenantId: "t", name: "Front desk", address: { line1: "1 Main St", city: "Denver", state: "CO", postal_code: "80202", country: "US" } });
    expect(loc).toMatch(/^tml_/);
    expect(await ensureTerminalLocation(stripe, ACCOUNT, "tml_existing", { tenantId: "t", name: "x", address: { country: "US" } })).toBe("tml_existing");
    expect(await createConnectionToken(stripe, ACCOUNT, loc)).toBeTruthy();
    const reader = await registerReader(stripe, ACCOUNT, { registrationCode: "simulated-wpe", label: "Front desk", locationId: loc });
    expect(reader.id).toMatch(/^tmr_/);
    expect(Array.isArray(await listReaders(stripe, ACCOUNT))).toBe(true);
  });

  it("sends a card_present intent to a reader and returns the settled intent", async () => {
    const pi = await collectOnReader(stripe, ACCOUNT, { readerId: "tmr_123", paymentIntentId: "pi_123", simulate: true, timeoutMs: 0 });
    expect(pi.id).toMatch(/^pi_/);
  });
});

describe("webhook signatures", () => {
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "payment_intent.succeeded", data: { object: {} } });

  it("accepts a correctly signed payload", () => {
    const event = verifyWebhook(stripe, payload, signTestPayload(stripe, payload, secret), secret);
    expect(event.id).toBe("evt_1");
  });

  it("rejects a tampered payload, a wrong secret and a missing header", () => {
    const sig = signTestPayload(stripe, payload, secret);
    expect(() => verifyWebhook(stripe, payload.replace("evt_1", "evt_2"), sig, secret)).toThrow();
    expect(() => verifyWebhook(stripe, payload, sig, "whsec_other")).toThrow();
    expect(() => verifyWebhook(stripe, payload, null, secret)).toThrow(/missing/);
  });

  it("knows which events it handles", () => {
    expect(isHandledEvent("charge.refunded")).toBe(true);
    expect(isHandledEvent("invoice.created")).toBe(false);
  });
});
