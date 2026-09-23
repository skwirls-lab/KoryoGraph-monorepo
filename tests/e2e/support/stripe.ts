import { expect, type FrameLocator, type Page } from "@playwright/test";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";

/** Test-mode Standard account already onboarded to the platform (see CLAUDE.md → Stripe). */
export const TEST_CONNECTED_ACCOUNT = process.env.STRIPE_TEST_CONNECTED_ACCOUNT ?? "";
export const stripeLive = Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && TEST_CONNECTED_ACCOUNT);

export async function connectRidgeline(): Promise<void> {
  await sql`update public.tenants set stripe_account_id = ${TEST_CONNECTED_ACCOUNT}, stripe_onboarding_complete = true where id = ${sid("tenant:ridgeline")}`;
}

export async function disconnectRidgeline(): Promise<void> {
  await sql`update public.tenants set stripe_account_id = null, stripe_onboarding_complete = false where id = ${sid("tenant:ridgeline")}`;
}

/** Opens "Add card", fills Stripe's Payment Element iframe and saves. */
export async function addCardViaElements(page: Page, number: string): Promise<void> {
  await page.getByRole("button", { name: "Add card" }).click();
  const frame: FrameLocator = page.frameLocator('iframe[title*="Secure payment input"]').first();
  await frame.locator('input[name="number"]').fill(number);
  await frame.locator('input[name="expiry"]').fill("12 / 34");
  await frame.locator('input[name="cvc"]').fill("123");
  const zip = frame.locator('input[name="postalCode"]');
  if (await zip.count()) await zip.fill("22150");
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page.getByText(`Card ending ${number.slice(-4)} saved`)).toBeVisible({ timeout: 30_000 });
}
