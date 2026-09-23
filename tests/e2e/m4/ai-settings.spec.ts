import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
let limitBefore: number | null = null;

test.beforeAll(async () => {
  const [b] = await sql<{ monthly_limit_cents: number }[]>`select monthly_limit_cents from tenant_ai_budgets where tenant_id = ${R}`;
  limitBefore = b?.monthly_limit_cents ?? null;
});

test.afterAll(async () => {
  if (limitBefore === null) await sql`delete from tenant_ai_budgets where tenant_id = ${R}`;
  else await sql`update tenant_ai_budgets set monthly_limit_cents = ${limitBefore} where tenant_id = ${R}`;
});

test.describe("@m4 AI settings", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("key status, test connection through the gateway (logged), budget", async ({ page }) => {
    await page.goto("/desk/settings");
    await page.getByRole("link", { name: /^AI/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "AI" })).toBeVisible();
    // The server decides the mode (the gate forces fixtures); assert against what it reports.
    const live = (await page.getByText(/^(Live|Recorded dev fixtures)$/).textContent()) === "Live";
    if (!live) {
      await expect(page.getByText("No key", { exact: true })).toBeVisible();
      await expect(page.getByText(/OPENROUTER_API_KEY isn.t set on this server/)).toBeVisible();
    }
    await expectNoSeriousA11yViolations(page);
    const before = await sql<{ n: number }[]>`select count(*)::int as n from ai_runs where tenant_id = ${R} and task_id = 'ping'`;
    await page.getByRole("button", { name: "Test connection" }).click();
    const status = page.getByRole("status").filter({ hasText: live ? /Connected|didn.t answer|No model/ : /recorded dev fixture/ });
    await expect(status).toBeVisible();
    await expect.poll(async () => (await sql<{ n: number }[]>`select count(*)::int as n from ai_runs where tenant_id = ${R} and task_id = 'ping'`)[0]?.n).toBe((before[0]?.n ?? 0) + 1);
    const [runRow] = await sql`select transport, status from ai_runs where tenant_id = ${R} and task_id = 'ping' order by created_at desc limit 1`;
    if (!live) expect(runRow).toEqual({ transport: "fixture", status: "ok" });
    await page.reload();
    await expect(page.getByRole("list", { name: "Recent AI runs" }).getByRole("listitem").first()).toContainText("ping");

    await page.getByLabel("Monthly AI budget ($)").fill("60.00");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/of \$60\.00/)).toBeVisible();
  });
});
