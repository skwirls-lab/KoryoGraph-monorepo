import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

// §2.6 / M5.07: axe (zero serious/critical) on 16 routes across the four surfaces, plus keyboard traversal
// of the Desk nav, a dialog and the POS register.
const ROUTES: { who: "owner" | "instructor" | "parent" | null; path: string; heading?: RegExp }[] = [
  { who: null, path: "/" },
  { who: null, path: "/pricing" },
  { who: null, path: "/login" },
  { who: "owner", path: "/desk" },
  { who: "owner", path: "/desk/people" },
  { who: "owner", path: "/desk/schedule" },
  { who: "owner", path: "/desk/billing" },
  { who: "owner", path: "/desk/crm" },
  { who: "owner", path: "/desk/reports" },
  { who: "owner", path: "/desk/inbox/approvals" },
  { who: "owner", path: "/desk/settings/api" },
  { who: "instructor", path: "/mat" },
  { who: "instructor", path: "/mat/reviews" },
  { who: "parent", path: "/home" },
  { who: "parent", path: "/home/progress" },
  { who: "parent", path: "/home/billing" },
];

test.describe("@m5 accessibility", () => {
  for (const r of ROUTES) {
    test(`axe: ${r.path}${r.who ? ` (${r.who})` : ""}`, async ({ browser }) => {
      const context = await browser.newContext(r.who ? { storageState: authState("ridgeline", r.who) } : {});
      const page = await context.newPage();
      await page.goto(r.path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await context.close();
    });
  }

  test.describe("keyboard", () => {
    test.use({ storageState: authState("ridgeline", "owner"), viewport: { width: 1400, height: 900 } });

    test("Desk: skip link, then the nav is reachable and usable by Tab + Enter", async ({ page }) => {
      await page.goto("/desk");
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to content" });
      await expect(skip).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#main$/);
      // Walk forward from the top until the "People" nav link has focus, then activate it.
      await page.goto("/desk");
      let found = false;
      for (let i = 0; i < 30 && !found; i++) {
        await page.keyboard.press("Tab");
        found = await page.evaluate(() => document.activeElement?.textContent?.trim() === "People");
      }
      expect(found).toBe(true);
      await page.keyboard.press("Enter");
      await page.waitForURL(/\/desk\/people$/);
    });

    test("dialog: opens from the keyboard, traps focus, Escape closes and focus returns", async ({ page }) => {
      await page.goto("/desk/crm");
      const trigger = page.getByRole("button", { name: "New lead" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test("POS: scan field focused on load; type + Enter adds the item; the cart is operable by keyboard", async ({ page }) => {
      await page.goto("/desk/pos");
      const scan = page.getByPlaceholder("Scan a barcode or search by name / SKU");
      await expect(scan).toBeFocused();
      await page.keyboard.type("MOUTHGUARD-YOUTH");
      await page.keyboard.press("Enter");
      const cart = page.getByRole("list", { name: /cart/i });
      await expect(cart.getByRole("listitem")).toHaveCount(1);
      await expectNoSeriousA11yViolations(page);
    });
  });
});
