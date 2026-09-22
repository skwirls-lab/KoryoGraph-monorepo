import { expect, test, type Page } from "@playwright/test";
import { sql, uniqueEmail } from "../../db/harness";

async function signUp(page: Page, school: string, email: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("School name").fill(school);
  await page.getByLabel("Your name").fill("Test Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("KoryoTest!2026");
  await expect(page.getByLabel("Timezone")).not.toHaveValue("");
  await page.getByLabel("Timezone").selectOption("America/Chicago");
  await page.getByRole("button", { name: "Start 14-day trial" }).click();
  await expect(page).toHaveURL(/\/desk\/onboarding$/);
  await expect(page.getByRole("heading", { level: 1, name: `Welcome to ${school}` })).toBeVisible();
}

test.describe("@m0 signup", () => {
  test("a new owner creates a school and lands on onboarding with a 14-day trial", async ({ browser }) => {
    const emailA = uniqueEmail("signup-a");
    const emailB = uniqueEmail("signup-b");

    const ctxA = await browser.newContext();
    await signUp(await ctxA.newPage(), "Tiger Claw Academy", emailA);
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await signUp(pageB, "Tiger Claw Academy", emailB);

    const rows = await sql<{ email: string; tenant_id: string; slug: string; role: string; tz: string; trial_modules: number; days: number }[]>`
      select p.email, t.id as tenant_id, t.slug, r.key as role, t.timezone as tz,
        (select count(*)::int from public.tenant_entitlements e where e.tenant_id = t.id and e.source = 'trial'
           and e.ends_at between now() + interval '13 days' and now() + interval '15 days') as trial_modules,
        round(extract(epoch from t.trial_ends_at - now()) / 86400)::int as days
      from public.profiles p
      join public.tenant_users tu on tu.user_id = p.id
      join public.tenants t on t.id = tu.tenant_id
      join public.roles r on r.id = tu.role_id
      where p.email in (${emailA}, ${emailB})
      order by p.email`;

    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).toMatchObject({ role: "owner", tz: "America/Chicago", trial_modules: 9, days: 14 });
    }
    expect(rows[0]?.tenant_id).not.toBe(rows[1]?.tenant_id);
    expect(rows[0]?.slug).not.toBe(rows[1]?.slug);

    // The onboarding checklist shows the trial modules from the database.
    await expect(pageB.getByRole("list", { name: "Enabled modules" }).getByRole("listitem")).toHaveCount(9);
    await ctxA.close();
    await ctxB.close();
  });

  test("an existing email is rejected with a clear message", async ({ page }) => {
    const email = uniqueEmail("dup");
    const ctx = await page.context().browser()?.newContext();
    if (!ctx) throw new Error("no browser");
    await signUp(await ctx.newPage(), "First School", email);
    await ctx.close();

    await page.goto("/signup");
    await page.getByLabel("School name").fill("Second School");
    await page.getByLabel("Your name").fill("Dup Owner");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("KoryoTest!2026");
    await page.getByRole("button", { name: "Start 14-day trial" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible();
  });
});
