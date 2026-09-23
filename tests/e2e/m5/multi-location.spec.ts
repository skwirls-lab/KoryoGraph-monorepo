import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";
import { loginWithPassword } from "../support/login";

const R = sid("tenant:ridgeline");
const INSTRUCTOR = sid("user:instructor@ridgelinetkd.demo");

test.beforeAll(async () => {
  // Ridgeline's plan has no Multi-location module; comp it for this spec (claims arrive with a fresh sign-in).
  await sql`insert into tenant_entitlements (tenant_id, module_key, source) values (${R}, 'multi_location', 'comp') on conflict (tenant_id, module_key) do update set ends_at = null`;
});

test.afterAll(async () => {
  await sql`delete from tenant_entitlements where tenant_id = ${R} and module_key = 'multi_location' and source = 'comp'`;
  await sql`update tenant_users set location_ids = null where tenant_id = ${R} and user_id = ${INSTRUCTOR}`;
  await sql`delete from locations where tenant_id = ${R} and name = 'Westside Dojo'`;
});

test.describe("@m5 multi-location", () => {
  test("add a second location → switcher + dashboard rollup; staff limited to one location", async ({ page }) => {
    await loginWithPassword(page, "owner@ridgelinetkd.demo", "KoryoDemo!2026");
    await page.goto("/desk/settings/location");
    await page.getByLabel("New location name").fill("Westside Dojo");
    await page.getByLabel("Street address").last().fill("8 Mill St");
    await page.getByLabel("City").last().fill("Denver");
    await page.getByLabel("Postal code").last().fill("80202");
    await page.getByRole("button", { name: "Add location" }).click();
    await expect(page.getByRole("list", { name: "Other locations" })).toContainText("Westside Dojo");

    await page.goto("/desk");
    const table = page.getByRole("table", { name: "Key numbers by location" });
    await expect(table).toContainText("Westside Dojo");
    const [total] = await sql<{ n: number }[]>`select count(*)::int as n from people where tenant_id = ${R} and status = 'active' and 'student' = any (type_flags) and archived_at is null and primary_location_id is not null`;
    await expect(table.getByRole("row", { name: /^All locations/ })).toContainText(String(total?.n));
    await expectNoSeriousA11yViolations(page);

    // Switch to the new location: the schedule follows (no classes there yet).
    await page.locator("header").getByRole("combobox", { name: "Location", exact: true }).selectOption({ label: "Westside Dojo" });
    await page.waitForLoadState("networkidle");
    await page.goto("/desk/schedule");
    await expect(page.getByText(/no classes/i).first()).toBeVisible();
    await page.locator("header").getByRole("combobox", { name: "Location", exact: true }).selectOption({ label: "All locations" });

    // Limit the instructor to the main location (Main Dojang).
    await page.goto(`/desk/staff/${INSTRUCTOR}`);
    await page.getByRole("region", { name: "Locations" }).getByLabel("Main Dojang").check();
    await page.getByRole("button", { name: "Save locations" }).click();
    await expect(page.getByText("Locations saved")).toBeVisible();
    const [tu] = await sql<{ n: number }[]>`select cardinality(location_ids) as n from tenant_users where tenant_id = ${R} and user_id = ${INSTRUCTOR}`;
    expect(tu?.n).toBe(1);
  });
});
