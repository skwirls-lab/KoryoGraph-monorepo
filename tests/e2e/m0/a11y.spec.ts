import { test } from "../support/fixtures";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";

test.describe("@m0 accessibility of the shells", () => {
  test("public pages", async ({ page }) => {
    for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
      await page.goto(path);
      await expectNoSeriousA11yViolations(page);
    }
  });

  test.describe("desk", () => {
    test.use({ storageState: authState("ridgeline", "owner") });
    test("dashboard and onboarding", async ({ page }) => {
      for (const path of ["/desk", "/desk/onboarding"]) {
        await page.goto(path);
        await expectNoSeriousA11yViolations(page);
      }
    });
  });

  test.describe("mat", () => {
    test.use({ storageState: authState("ridgeline", "instructor"), viewport: { width: 390, height: 844 } });
    test("today", async ({ page }) => {
      await page.goto("/mat");
      await expectNoSeriousA11yViolations(page);
    });
  });

  test.describe("home", () => {
    test.use({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } });
    test("home", async ({ page }) => {
      await page.goto("/home");
      await expectNoSeriousA11yViolations(page);
    });
  });
});
