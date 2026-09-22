import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { ROLE_ACCOUNTS, accountEmail } from "../../scripts/seed/accounts";
import { DEMO_PASSWORD } from "../../scripts/seed/context";

export const AUTH_DIR = path.resolve(import.meta.dirname, ".auth");

/** Signs in each seeded Ridgeline role (and Harbor's owner) once and saves the browser storage state. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3100";
  mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();
  const accounts = [
    ...ROLE_ACCOUNTS.map((a) => ({ tenant: "ridgeline" as const, local: a.local })),
    { tenant: "harbor" as const, local: "owner" },
  ];
  for (const { tenant, local } of accounts) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/login");
    await page.locator("input[name=email]:visible").fill(accountEmail(tenant, local));
    await page.locator("input[name=password]:visible").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL((u) => ["/desk", "/mat", "/home"].some((p) => u.pathname.startsWith(p)), { timeout: 30_000 });
    } catch {
      throw new Error(`Global setup could not sign in ${accountEmail(tenant, local)} — run \`npm run db:reset\` first.`);
    }
    await context.storageState({ path: path.join(AUTH_DIR, `${tenant}-${local}.json`) });
    await context.close();
  }
  await browser.close();
}
