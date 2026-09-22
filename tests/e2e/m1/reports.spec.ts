import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");

test.describe("@m1 dashboard, reports, export", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("dashboard shows live counts; attendance report renders chart and tables; export produces a ZIP", async ({ page }) => {
    const [truth] = await sql<{ n: number }[]>`select count(*)::int as n from people where tenant_id = ${R} and status = 'active' and 'student' = any(type_flags) and archived_at is null`;
    await page.goto("/desk");
    await expect(page.getByRole("region", { name: "Key numbers" })).toContainText(`Active students${truth?.n}`);

    await page.goto("/desk/reports/attendance?weeks=8");
    await expect(page.getByRole("figure", { name: "Check-ins per week, last 8 weeks" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Check-ins by week" }).getByRole("row")).toHaveCount(1 + 9);

    await page.goto("/desk/reports/roster");
    await expect(page.getByRole("table", { name: "Membership roster" })).toContainText("Maya Cooper");

    await page.goto("/desk/settings/export");
    await page.getByRole("button", { name: "Export all data" }).click();
    await expect(page.getByText("Your export is ready")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("list", { name: "Exports" }).getByRole("button", { name: "Download ZIP" }).first()).toBeVisible();
  });
});
