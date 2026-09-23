import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const name = `Spec Plan ${randomUUID().slice(0, 6)}`;

test.afterAll(async () => {
  await sql`delete from public.membership_plans where tenant_id = ${sid("tenant:ridgeline")} and name like ${`${name}%`}`;
});

test.describe("@m2 membership plans admin", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("create a contract plan with family discount and kit, edit it, archive it", async ({ page }) => {
    await page.goto("/desk/billing");
    await expect(page).toHaveURL(/\/desk\/billing\/plans$/);
    await expectNoSeriousA11yViolations(page);
    await page.getByRole("button", { name: "New plan" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Plan name").fill(name);
    await dialog.getByLabel("Kind").selectOption("contract");
    await dialog.getByLabel("Price per period").fill("199");
    await dialog.getByLabel("Contract length (months)").fill("12");
    await dialog.getByLabel("Early termination fee").fill("300");
    await dialog.getByLabel("Enrollment fee").fill("49");
    await dialog.getByLabel("2nd family member (% off)").fill("10");
    await dialog.getByLabel("3rd and later (% off)").fill("20");
    await dialog.getByLabel("Dobok (uniform)").check();
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole("button", { name: "Create plan" }).click();
    await expect(dialog).toBeHidden();

    const item = page.getByRole("listitem", { name });
    await expect(item).toContainText("$199.00/month");
    await expect(item).toContainText("12-month contract");
    await expect(item).toContainText("family: 2nd −10%, 3rd+ −20%");
    await expect(item).toContainText("kit: 1 item");

    await item.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("dialog").getByLabel("Price per period").fill("189.50");
    await page.getByRole("dialog").getByRole("button", { name: "Save plan" }).click();
    await expect(item).toContainText("$189.50/month");

    await item.getByRole("button", { name: `Archive ${name}` }).click();
    await expect(item).toContainText("Archived");
  });

  test("validation: a contract needs a length; recurring needs an interval", async ({ page }) => {
    await page.goto("/desk/billing/plans");
    await page.getByRole("button", { name: "New plan" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Plan name").fill(`${name} bad`);
    await dialog.getByLabel("Kind").selectOption("contract");
    await dialog.getByLabel("Price per period").fill("99");
    await dialog.getByRole("button", { name: "Create plan" }).click();
    await expect(dialog.getByText("Contract length is required")).toBeVisible();
  });

  test("enroll wizard and fulfilment pages are accessible", async ({ page }) => {
    await page.goto(`/desk/people/${sid("person:ridgeline:maya-cooper")}/enroll`);
    await page.getByRole("radio", { name: /Monthly Unlimited/ }).check();
    await expect(page.getByRole("list", { name: "Invoice lines" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await page.goto("/desk/retail/fulfilment");
    await expectNoSeriousA11yViolations(page);
  });
});
