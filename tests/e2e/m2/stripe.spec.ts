import type { Page } from "@playwright/test";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";
import { addCardViaElements as addCard, connectRidgeline, disconnectRidgeline, stripeLive } from "../support/stripe";

// Live Stripe test mode (tagged @stripe; the gate skips it without STRIPE_SECRET_KEY and reports a HANDOFF).
// Needs STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_TEST_CONNECTED_ACCOUNT: a test-mode
// Standard account already onboarded to the platform (Stripe can't complete hosted onboarding headlessly).
const ADAMS = sid("household:ridgeline:adams");

async function charge(page: Page, cardLast4: string) {
  await page.getByRole("button", { name: "Charge card" }).click();
  await page.getByLabel("Amount (USD)").fill("1.00");
  const option = await page.getByLabel("Card").locator("option").filter({ hasText: `ending ${cardLast4}` }).textContent();
  await page.getByLabel("Card").selectOption({ label: option ?? "" });
  await page.getByRole("button", { name: "Charge", exact: true }).click();
}

test.describe("@m2 @stripe Stripe test mode", () => {
  test.skip(!stripeLive, "needs STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_TEST_CONNECTED_ACCOUNT");

  test.beforeAll(async () => {
    await connectRidgeline();
    await sql`update public.households set stripe_customer_id = null where id = ${ADAMS}`;
    await sql`update public.payment_methods set status = 'detached', is_default = false where household_id = ${ADAMS}`;
  });

  test.afterAll(async () => {
    await disconnectRidgeline();
  });

  test("vault 4242 via Elements and charge $1.00; 0341 vaults but its charge fails and is recorded", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await page.goto(`/desk/households/${ADAMS}`);

    await addCard(page, "4242424242424242");
    await charge(page, "4242");
    await expect(page.getByText("Payment succeeded")).toBeVisible({ timeout: 30_000 });
    const [ok] = await sql<{ status: string; amount_cents: number }[]>`select status, amount_cents from public.payments where household_id = ${ADAMS} and method = 'card' order by created_at desc limit 1`;
    expect(ok).toEqual({ status: "succeeded", amount_cents: 100 });

    await addCard(page, "4000000000000341");
    await charge(page, "0341");
    await expect(page.getByRole("alert")).toContainText(/declined/i, { timeout: 30_000 });
    const [failed] = await sql<{ status: string; failure_code: string | null }[]>`select status, failure_code from public.payments where household_id = ${ADAMS} and method = 'card' order by created_at desc limit 1`;
    expect(failed?.status).toBe("failed");
    expect(failed?.failure_code).toBeTruthy();
  });
});
