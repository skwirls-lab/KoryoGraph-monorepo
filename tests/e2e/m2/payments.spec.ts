import { sid } from "../../../scripts/lib/ids";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const ADAMS = sid("household:ridgeline:adams");

// Without Stripe keys the product must say so plainly and never pretend to take a card (§0 honesty).
test.describe("@m2 payments without Stripe keys", () => {
  test.skip(Boolean(process.env.STRIPE_SECRET_KEY), "a Stripe key is configured; stripe.spec covers the live flow");

  test("owner sees that Stripe isn't configured and what to set", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await page.goto("/desk/settings");
    await page.getByRole("link", { name: /Payments/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();
    await expect(page.getByText("Stripe isn't configured on this server.")).toBeVisible();
    await expect(page.getByText("STRIPE_SECRET_KEY", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Stripe" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("household page offers no card entry and explains why", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await page.goto(`/desk/households/${ADAMS}`);
    await expect(page.getByRole("heading", { name: "Payment methods" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add card" })).toBeDisabled();
    await expect(page.getByText(/card payments are unavailable/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Charge card" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a parent sees that online card payments aren't available yet", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: authState("ridgeline", "parent") })).newPage();
    await page.goto("/home/billing");
    await expect(page.getByRole("button", { name: "Add card" })).toBeDisabled();
    await expect(page.getByText("Online card payments aren't available yet.", { exact: false })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("a school without the Billing module is told so", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: authState("harbor", "owner") })).newPage();
    await page.goto("/desk/settings/payments");
    await expect(page.getByText("part of the Billing module", { exact: false })).toBeVisible();
  });
});
