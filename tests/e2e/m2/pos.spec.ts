import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const LOC = sid("location:ridgeline:main");
const BELT = sid("variant:ridgeline:white-belt:4");
const DOBOK = sid("variant:ridgeline:dobok:2");
const onHand = async (v: string) => (await sql<{ on_hand: number }[]>`select on_hand from public.inventory_levels where variant_id = ${v} and location_id = ${LOC}`)[0]?.on_hand ?? 0;

test.beforeAll(async () => {
  await sql`update public.cash_drawers set closed_at = now(), closing_cents = 0, expected_cents = 0, variance_cents = 0 where location_id = ${LOC} and closed_at is null`;
  // Make sure there's stock to sell.
  for (const v of [BELT, DOBOK]) {
    if ((await onHand(v)) < 5) await sql`insert into public.inventory_movements (tenant_id, variant_id, location_id, delta, reason, note) values (${sid("tenant:ridgeline")}, ${v}, ${LOC}, 10, 'receive', 'pos.spec top-up')`;
  }
});

test.describe("@m2 point of sale", () => {
  test.use({ storageState: authState("ridgeline", "owner"), viewport: { width: 1024, height: 900 } });

  test("sell 2 items for cash → stock down → receipt → return one → stock back, refund recorded → drawer variance", async ({ page }) => {
    const beltBefore = await onHand(BELT);
    const dobokBefore = await onHand(DOBOK);
    await page.goto("/desk/pos");
    await page.getByRole("button", { name: "Open drawer" }).click();
    await page.getByLabel("Starting cash").fill("100");
    await page.getByRole("dialog").getByRole("button", { name: "Open drawer" }).click();
    await expect(page.getByText("Cash drawer open")).toBeVisible();

    // Barcode scanner input: code + Enter adds the exact SKU match.
    const scan = page.getByLabel("Scan or search items");
    await scan.fill("WHITE-BELT-4");
    await scan.press("Enter");
    await expect(page.getByRole("list", { name: "Cart" }).getByRole("listitem", { name: "White belt (4)" })).toBeVisible();
    await scan.fill("DOBOK-2");
    await scan.press("Enter");
    await expect(page.getByRole("list", { name: "Cart" }).getByRole("listitem")).toHaveCount(2);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: /^Charge \$/ }).click();
    await expect(page.getByLabel("Balance due")).toBeVisible();
    await page.getByLabel("Cash received").fill("100");
    await expect(page.getByText(/^Change:/)).toBeVisible();
    await page.getByRole("button", { name: "Take payment" }).click();
    const done = page.getByRole("status").filter({ hasText: "Sale complete" });
    await expect(done).toBeVisible();
    await expect(done).toContainText(/Change \$\d+\.\d\d/);
    expect(await onHand(BELT)).toBe(beltBefore - 1);
    expect(await onHand(DOBOK)).toBe(dobokBefore - 1);

    await done.getByRole("link", { name: "Receipt" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Receipt \d+/ })).toBeVisible();
    await expect(page.getByRole("article", { name: "Receipt" })).toContainText("White belt (4) × 1");
    await expectNoSeriousA11yViolations(page);
    await page.getByLabel(/White belt \(4\)/).fill("1");
    await page.getByLabel("Reason").fill("Wrong size");
    await page.getByRole("button", { name: /^Return ≈/ }).click();
    await expect(page.getByText(/Returned — give back \$\d+\.\d\d cash/)).toBeVisible();
    expect(await onHand(BELT)).toBe(beltBefore);
    await expect(page.getByText(/^Returns:/)).toBeVisible();
    const saleId = page.url().split("/").pop() ?? "";
    const refunds = await sql`select r.id from public.refunds r join public.payments p on p.id = r.payment_id join public.pos_sales s on s.invoice_id = p.invoice_id where s.id = ${saleId}`;
    expect(refunds.length).toBe(1);

    // Close the drawer $1.00 short.
    await page.goto("/desk/pos");
    const expectedText = await page.getByText("Cash drawer open").locator("strong").textContent();
    const expected = Math.round(Number((expectedText ?? "").replace(/[$,]/g, "")) * 100);
    await page.getByRole("button", { name: "Close drawer" }).click();
    await page.getByLabel("Counted cash").fill(((expected - 100) / 100).toFixed(2));
    await page.getByRole("dialog").getByRole("button", { name: "Close drawer" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("Variance-$1.00");
  });
});
