import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { uniqueEmail } from "../../db/harness";
import { authState } from "../support/auth";

const tag = randomUUID().slice(0, 6);
const programName = `Spec Hapkido ${tag}`;

async function addRank(page: Page, name: string, color = "#f5f5f5") {
  await page.getByRole("button", { name: "Add rank" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Rank name", { exact: true }).fill(name);
  await dialog.getByLabel("Belt colour", { exact: true }).fill(color);
  await dialog.getByLabel("Stripes", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "Add rank" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("listitem", { name: new RegExp(`\\d+\\. ${name}$`) })).toBeVisible();
}

test.describe("@m1 desk programs", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("build a ladder: add ranks, reorder, set requirements with skills", async ({ page }) => {
    await page.goto("/desk/programs");
    await page.getByRole("button", { name: "New program" }).click();
    await page.getByRole("dialog").getByLabel("Program name", { exact: true }).fill(programName);
    await page.getByRole("dialog").getByRole("button", { name: "Create program" }).click();
    await expect(page.getByRole("heading", { level: 1, name: programName })).toBeVisible();
    const programUrl = page.url();

    await addRank(page, "White");
    await addRank(page, "Yellow", "#facc15");
    await addRank(page, "Orange", "#f97316");

    // Reorder: Orange up one → White, Orange, Yellow.
    await page.getByRole("button", { name: "Move Orange up" }).click();
    const ladder = page.getByRole("list", { name: "Ranks in order" }).getByRole("listitem");
    await expect(ladder.nth(1)).toHaveAccessibleName("2. Orange");
    await page.reload();
    await expect(ladder.nth(0)).toHaveAccessibleName("1. White");
    await expect(ladder.nth(1)).toHaveAccessibleName("2. Orange");
    await expect(ladder.nth(2)).toHaveAccessibleName("3. Yellow");

    // A skill for this program, then require it for Yellow.
    await page.goto("/desk/curriculum");
    await page.getByRole("button", { name: "New skill" }).click();
    const sd = page.getByRole("dialog");
    await sd.getByLabel("Name", { exact: true }).fill(`Wrist lock ${tag}`);
    await sd.getByLabel("Category", { exact: true }).selectOption("self_defense");
    await sd.getByLabel("Program", { exact: true }).selectOption({ label: programName });
    await sd.getByRole("button", { name: "Save skill" }).click();
    await expect(sd).toBeHidden();
    await expect(page.getByRole("heading", { name: `Wrist lock ${tag}` })).toBeVisible();

    await page.goto(programUrl);
    await page.getByRole("listitem", { name: "3. Yellow" }).getByRole("button", { name: "Requirements" }).click();
    const rd = page.getByRole("dialog");
    await rd.getByLabel("Minimum classes").fill("12");
    await rd.getByLabel("Minimum days").fill("30");
    await rd.getByLabel("Requires instructor approval").check();
    await rd.getByLabel(`Wrist lock ${tag}`).check();
    await rd.getByRole("button", { name: "Save requirements" }).click();
    await expect(rd).toBeHidden();
    await expect(page.getByRole("listitem", { name: "3. Yellow" })).toContainText("12 classes · 30 days · 1 skill · approval");
  });

  test("a brand-new school starts with the standard Taekwondo ladder", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/signup");
    await page.getByLabel("School name").fill(`Ladder Check ${tag}`);
    await page.getByLabel("Your name").fill("Ladder Owner");
    await page.getByLabel("Email").fill(uniqueEmail("ladder"));
    await page.getByLabel("Password").fill("KoryoTest!2026");
    await page.getByRole("button", { name: "Start 14-day trial" }).click();
    await expect(page).toHaveURL(/\/desk\/onboarding$/);
    await page.goto("/desk/programs");
    await page.getByRole("link", { name: /Taekwondo/ }).click();
    const ladder = page.getByRole("list", { name: "Ranks in order" }).getByRole("listitem");
    await expect(ladder).toHaveCount(11);
    await expect(ladder.first()).toHaveAccessibleName("1. White belt (10th gup)");
    await expect(ladder.last()).toHaveAccessibleName("11. Black belt (1st dan)");
    await expect(page.getByRole("listitem", { name: "2. Yellow belt (9th gup)" })).toContainText("16 classes · 60 days · 3 skills");
    await ctx.close();
  });
});
