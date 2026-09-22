import { expect, type Page } from "@playwright/test";
import { PASSWORD } from "../../db/harness";

export async function loginWithPassword(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.locator("input[name=email]:visible").fill(email);
  await page.locator("input[name=password]:visible").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
