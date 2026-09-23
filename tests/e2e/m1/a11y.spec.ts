import { sid } from "../../../scripts/lib/ids";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const MAYA = sid("person:ridgeline:maya-cooper");
const COOPER = sid("household:ridgeline:cooper");

test.describe("@m1 accessibility (zero serious/critical)", () => {
  test.describe("desk", () => {
    test.use({ storageState: authState("ridgeline", "owner") });
    test("dashboard, people, profile, household, schedule, programs, inbox, documents, reports", async ({ page }) => {
      for (const path of ["/desk", "/desk/people", `/desk/people/${MAYA}`, `/desk/people/${MAYA}?tab=progress`, `/desk/households/${COOPER}`, "/desk/schedule",
        "/desk/programs", "/desk/curriculum", "/desk/inbox", "/desk/outbox", "/desk/documents", "/desk/compliance", "/desk/reports/attendance", "/desk/settings/templates"]) {
        await page.goto(path);
        await expectNoSeriousA11yViolations(page);
      }
      await page.goto("/desk/schedule");
      await page.getByRole("link", { name: /Youth Taekwondo/ }).first().click();
      await expectNoSeriousA11yViolations(page);
    });
  });

  test.describe("mat", () => {
    test.use({ storageState: authState("ridgeline", "instructor"), viewport: { width: 390, height: 844 } });
    test("today, a class roster, students", async ({ page }) => {
      await page.goto("/mat");
      await expectNoSeriousA11yViolations(page);
      await page.getByRole("list", { name: "Today's classes" }).getByRole("link").first().click();
      await expect(page.getByRole("list", { name: "Roster" })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await page.goto("/mat/students");
      await expectNoSeriousA11yViolations(page);
    });
  });

  test.describe("home", () => {
    test.use({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } });
    test("home, schedule, progress, messages, forms", async ({ page }) => {
      for (const path of ["/home", "/home/schedule", "/home/progress", "/home/messages", "/home/documents"]) {
        await page.goto(path);
        await expectNoSeriousA11yViolations(page);
      }
    });
  });

  test("kiosk (unpaired and paired)", async ({ browser }) => {
    const anon = await (await browser.newContext()).newPage();
    await anon.goto("/kiosk");
    await expectNoSeriousA11yViolations(anon);
    const ctx = await browser.newContext({ storageState: authState("ridgeline", "admin"), viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await page.goto("/kiosk");
    await expectNoSeriousA11yViolations(page);
    await page.getByLabel("Device name").fill("a11y kiosk");
    await page.getByRole("button", { name: "Pair this device" }).click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("maya");
    await expect(page.getByRole("list", { name: "Matching students" }).getByRole("button").first()).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await ctx.close();
  });
});
