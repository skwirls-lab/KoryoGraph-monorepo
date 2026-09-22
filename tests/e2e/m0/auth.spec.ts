import { expect, test } from "../support/fixtures";
import { addMember, createTenantWithOwner } from "../../db/harness";
import { loginWithPassword } from "../support/login";
import { waitForLink } from "../support/mailpit";

let owner = "";
let instructor = "";
let parent = "";

test.beforeAll(async () => {
  const t = await createTenantWithOwner("Auth Spec Dojang");
  owner = t.ownerEmail;
  instructor = await addMember(t.tenantId, "instructor");
  parent = await addMember(t.tenantId, "parent");
});

test.describe("@m0 auth", () => {
  test("password login lands each role on its surface", async ({ browser }) => {
    for (const [email, path, heading] of [
      [owner, "/desk", "Dashboard"],
      [instructor, "/mat", "Today"],
      [parent, "/home", "Home"],
    ] as const) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await loginWithPassword(page, email);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await ctx.close();
    }
  });

  test("unauthenticated /desk redirects to /login?next=/desk", async ({ page }) => {
    await page.goto("/desk");
    await expect(page).toHaveURL(/\/login\?next=%2Fdesk$/);
  });

  test("an instructor gets a 403 page on /desk", async ({ page }) => {
    await loginWithPassword(page, instructor);
    const res = await page.goto("/desk");
    expect(res?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: /don.t have access/ })).toBeVisible();
  });

  test("wrong password shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[name=email]:visible").fill(owner);
    await page.locator("input[name=password]:visible").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("magic link signs in via the emailed link", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: "Email me a link" }).click();
    await page.locator("input[name=email]:visible").fill(owner);
    await page.getByRole("button", { name: "Send sign-in link" }).click();
    await expect(page.getByRole("status")).toContainText("sign-in link is on its way");
    const link = await waitForLink(owner, /http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^"\s<]+/);
    await page.goto(link);
    await expect(page).toHaveURL(/\/desk$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });

  test("sign out returns to /login and protects /desk again", async ({ page }) => {
    await loginWithPassword(page, owner);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/desk");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
