import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const REPORTS = [
  ["/desk/reports/revenue", "Revenue", "revenue"],
  ["/desk/reports/mrr", "MRR & churn", "mrr"],
  ["/desk/reports/ar-aging", "AR aging", "ar"],
  ["/desk/reports/payments", "Payments & refunds", "payments"],
  ["/desk/reports/deferred", "Deferred revenue", "deferred"],
] as const;

test.describe("@m2 money reports", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("each money report renders accessibly and exports CSV", async ({ page }) => {
    await page.goto("/desk/reports");
    for (const [, title] of REPORTS) await expect(page.getByRole("link", { name: new RegExp(`^${title.replace("&", "&")}`) })).toBeVisible();
    for (const [path, title, report] of REPORTS) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      const res = await page.request.get(`/desk/reports/money/export?report=${report}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/csv");
    }
  });

  test("accounting export downloads sales lines by GL account and payments", async ({ page }) => {
    await page.goto("/desk/reports/accounting");
    await expectNoSeriousA11yViolations(page);
    const sales = await page.request.get("/desk/reports/money/export?report=accounting-lines");
    const body = await sales.text();
    expect(body.split(/\r?\n/)[0]).toBe("date,invoice,customer,account,class,category,description,quantity,amount,tax,total,source");
    const payments = await page.request.get("/desk/reports/money/export?report=accounting-payments");
    expect((await payments.text()).split(/\r?\n/)[0]).toBe("date,type,customer,invoice,method,amount,reference");
  });

  test("a core-only school has no money reports", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: authState("harbor", "owner") })).newPage();
    await page.goto("/desk/reports");
    await expect(page.getByRole("link", { name: /^Revenue/ })).toHaveCount(0);
    const res = await page.request.get("/desk/reports/money/export?report=revenue");
    expect(res.status()).toBe(403);
  });
});
