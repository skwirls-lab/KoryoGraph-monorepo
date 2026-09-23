import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const started = new Date();

test.afterAll(async () => {
  await sql`delete from saved_reports where tenant_id = ${R} and created_at >= ${started}`;
});

test.describe("@m4 natural-language reports", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("'attendance by program last 8 weeks' → validated query → line chart + table → save → re-runs", async ({ page }) => {
    await page.goto("/desk/reports");
    await page.getByRole("link", { name: "Ask a report" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "attendance by program, last 8 weeks" }).click();
    const result = page.getByRole("region", { name: "Attendance by program — last 8 weeks" });
    await expect(result).toBeVisible({ timeout: 30_000 });
    const chart = result.getByRole("figure", { name: "Attendance by program — last 8 weeks" });
    await expect(chart.locator("svg .recharts-line").first()).toBeVisible();
    await expect(chart.locator(".recharts-legend-item").first()).toBeVisible();

    // The table's total equals the same count computed directly from attendance.
    const table = result.getByRole("region", { name: "Report rows" });
    const headers = await table.locator("thead th").allTextContents();
    const col = headers.indexOf("check ins") + 1;
    expect(col).toBeGreaterThan(0);
    const cells = await table.locator(`tbody tr td:nth-child(${col})`).allTextContents();
    const shown = cells.reduce((a, c) => a + Number(c), 0);
    const [truth] = await sql<{ n: number }[]>`
      select coalesce(sum(greatest(cardinality(s.program_ids), 1)), 0)::int as n from attendance a join class_sessions s on s.id = a.session_id join tenants t on t.id = s.tenant_id
      where s.tenant_id = ${R} and s.status <> 'cancelled' and s.starts_at <= now()
        and (date_trunc('week', s.starts_at at time zone t.timezone))::date >= date_trunc('week', current_date)::date - 56
        and (date_trunc('week', s.starts_at at time zone t.timezone))::date < date_trunc('week', current_date)::date`;
    expect(shown).toBe(truth?.n);
    await expect(result.getByText("Show the query")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await result.getByLabel("Report name").fill("Program attendance (8 weeks)");
    await result.getByRole("button", { name: "Save as report" }).click();
    await page.waitForURL(/\/desk\/reports\/saved\//);
    await expect(page.getByRole("heading", { level: 1, name: "Program attendance (8 weeks)" })).toBeVisible();
    await expect(page.getByRole("figure", { name: "Program attendance (8 weeks)" }).locator("svg .recharts-line").first()).toBeVisible();
    await page.goto("/desk/reports");
    await expect(page.getByRole("list", { name: "Saved reports" })).toContainText("Program attendance (8 weeks)");
  });
});
