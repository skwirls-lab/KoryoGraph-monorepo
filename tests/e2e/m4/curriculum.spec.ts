import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const started = new Date();

test.afterAll(async () => {
  await sql`update class_sessions set lesson_plan_id = null where lesson_plan_id in (select id from lesson_plans where tenant_id = ${R} and source = 'ai' and created_at >= ${started})`;
  await sql`delete from lesson_plans where tenant_id = ${R} and source = 'ai' and created_at >= ${started}`;
});

test.describe("@m4 curriculum builder", () => {
  test("Desk: prompt → 2 draft plans from the library (bogus skill dropped) → save, week 1 on a class → Mat shows it", async ({ browser }) => {
    test.setTimeout(90_000);
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto("/desk/curriculum");
    await desk.getByRole("link", { name: "Lesson builder" }).click();
    await desk.waitForURL(/curriculum\/build/);
    await desk.waitForLoadState("networkidle");
    const program = desk.getByLabel("Program", { exact: true });
    await program.selectOption({ label: "Youth Taekwondo" });
    await expect(program.locator("option:checked")).toHaveText("Youth Taekwondo");
    await desk.getByLabel("Weeks").fill("2");
    await desk.getByLabel("Class length (min)").fill("55");
    await desk.getByLabel("What do you want to teach?").fill("A 2-week sparring block for green to blue belts: footwork, counters and ring awareness");
    await expectNoSeriousA11yViolations(desk);
    await desk.getByRole("button", { name: "Draft lesson plans" }).click();
    const drafts = desk.getByRole("list", { name: "Draft plans" });
    await expect(drafts.getByRole("listitem").filter({ has: desk.getByRole("textbox") })).toHaveCount(2);
    await expect(desk.getByText("1 skill reference(s) weren't in your library and were removed.")).toBeVisible();
    await expect(desk.getByText("Corner escape drill")).toBeVisible();
    await expectNoSeriousA11yViolations(desk);
    const select = desk.getByLabel("Use for class").first();
    const value = await select.locator("option").nth(1).getAttribute("value");
    await select.selectOption(value ?? "");
    await desk.getByRole("button", { name: "Save plans" }).click();
    await desk.waitForURL(/lesson-plans/);
    const saved = await sql<{ name: string; skills: number }[]>`select name, (select count(*) from jsonb_array_elements(sections) s, jsonb_array_elements_text(s -> 'skill_ids') k)::int as skills
      from lesson_plans where tenant_id = ${R} and source = 'ai' and created_at >= ${started} order by name`;
    expect(saved.map((s) => s.name)).toEqual(["Sparring block · week 1: footwork & distance", "Sparring block · week 2: counters under pressure"]);
    const bogus = await sql`select id from lesson_plans where created_at >= ${started} and sections::text like '%00000000-0000-4000-8000-000000000000%'`;
    expect(bogus).toHaveLength(0);

    const mat = await (await browser.newContext({ storageState: authState("ridgeline", "instructor") })).newPage();
    await mat.goto(`/mat/session/${value}`);
    await expect(mat.getByRole("region", { name: "Lesson plan" })).toContainText("Footwork");
    await expect(mat.getByRole("combobox", { name: "Choose a lesson plan" })).toHaveValue(/[0-9a-f-]{36}/);
    await expect(mat.getByRole("region", { name: "Lesson plan" })).toContainText("Fighting stance & footwork");
  });
});
