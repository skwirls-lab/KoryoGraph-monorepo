import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const name = `Spec Gi ${randomUUID().slice(0, 6)}`;

test.afterAll(async () => {
  await sql`delete from public.products where tenant_id = ${sid("tenant:ridgeline")} and name = ${name}`;
});

test.describe("@m2 retail admin", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("create a product with 3 sizes, adjust stock, low stock shows below the reorder point", async ({ page }) => {
    await page.goto("/desk/retail");
    await expect(page).toHaveURL(/\/desk\/retail\/products$/);
    await expectNoSeriousA11yViolations(page);
    await page.getByRole("button", { name: "New product" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Sizes").fill("S, M, L");
    await dialog.getByLabel("Price").fill("45");
    await dialog.getByLabel("Cost").fill("18.50");
    await dialog.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    for (const size of ["S", "M", "L"]) await expect(page.getByLabel(`Size (size ${size})`)).toHaveValue(size);
    await expectNoSeriousA11yViolations(page);

    // Upload a product photo (private storage, shown through a signed URL).
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    await page.getByLabel("Image", { exact: true }).setInputFiles({ name: "gi.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("list", { name: "Product images" }).getByRole("img")).toHaveCount(1);

    // Change one size's price in the grid.
    await page.getByLabel("Price (size L)").fill("49.00");
    await page.getByRole("row").filter({ has: page.getByLabel("Price (size L)") }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    await page.getByRole("link", { name: "Stock" }).click();
    const rowS = page.getByRole("row", { name: `${name} (S)` });
    await expect(rowS.getByRole("cell").nth(2)).toHaveText("0");
    await rowS.getByRole("button", { name: `Adjust stock for ${name} (S)` }).click();
    await page.getByLabel("Quantity (+/−)").fill("5");
    await page.getByRole("button", { name: "Save adjustment" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(rowS.getByRole("cell").nth(2)).toHaveText("5");
    await expect(rowS.getByText("Low")).toHaveCount(0);

    const reorder = rowS.getByLabel(`Reorder point for ${name} (S)`);
    await reorder.fill("8");
    await reorder.press("Enter");
    await expect(rowS.getByText("Low")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("link", { name: /Low stock only/ }).click();
    await expect(page.getByRole("row", { name: `${name} (S)` })).toBeVisible();
    await expect(page.getByRole("row", { name: `${name} (M)` })).toHaveCount(0);

    await page.goto("/desk/retail/inventory/movements");
    await expect(page.getByRole("list", { name: "Movements" }).getByRole("listitem").first()).toContainText(`+5${name} (S)`);
  });

  test("suppliers list shows contact details", async ({ page }) => {
    await page.goto("/desk/retail/suppliers");
    await expect(page.getByRole("listitem", { name: "Dojo Supply Co." })).toContainText("orders@dojosupply.example");
    await expectNoSeriousA11yViolations(page);
  });
});
