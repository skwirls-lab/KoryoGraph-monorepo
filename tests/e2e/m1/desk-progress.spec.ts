import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const LEO = sid("person:ridgeline:leo-cooper");
const tag = randomUUID().slice(0, 6);
const programName = `Progress Spec ${tag}`;
let programId = "";

test.beforeAll(async () => {
  const [p] = await sql<{ id: string }[]>`insert into public.programs (tenant_id, name, slug) values (${R}, ${programName}, ${`progress-spec-${tag}`}) returning id`;
  programId = p?.id ?? "";
  const ranks: string[] = [];
  for (const [i, n] of ["White", "Yellow", "Orange"].entries()) {
    const [r] = await sql<{ id: string }[]>`insert into public.ranks (tenant_id, program_id, name, position, stripes_max) values (${R}, ${programId}, ${n}, ${i + 1}, 3) returning id`;
    ranks.push(r?.id ?? "");
  }
  const [s] = await sql<{ id: string }[]>`insert into public.skills (tenant_id, program_id, category, name) values (${R}, ${programId}, 'kick', ${`Spec kick ${tag}`}) returning id`;
  await sql`insert into public.rank_requirements (tenant_id, rank_id, min_classes, min_days) values (${R}, ${ranks[1] ?? ""}, 0, 0)`;
  await sql`insert into public.rank_skills (tenant_id, rank_id, skill_id) values (${R}, ${ranks[1] ?? ""}, ${s?.id ?? ""})`;
});

test.afterAll(async () => {
  await sql`delete from public.programs where id = ${programId}`;
});

test.describe("@m1 desk progress", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("enroll, sign off, award a stripe, promote, and see the history", async ({ page }) => {
    await page.goto(`/desk/people/${LEO}?tab=progress`);
    await page.getByRole("button", { name: "Enroll in a program" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Program").selectOption({ label: programName });
    await d.getByLabel("Starting rank").selectOption({ label: "White" });
    await d.getByRole("button", { name: "Enroll" }).click();

    const panel = page.getByRole("region", { name: `${programName} progress` });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Almost eligible");
    await expect(panel).toContainText(`Sign off: Spec kick ${tag}`);

    await panel.getByRole("button", { name: `Sign off Spec kick ${tag}` }).click();
    await expect(panel).toContainText("Eligible to test");

    await panel.getByRole("button", { name: "Award stripe" }).click();
    await expect(page.getByText("Stripe awarded (1)")).toBeVisible();
    await expect(panel.getByLabel("White, 1 stripe")).toBeVisible();

    await panel.getByRole("button", { name: "Promote" }).click();
    const pd = page.getByRole("dialog");
    await pd.getByLabel("New rank").selectOption({ label: "Yellow" });
    await pd.getByLabel("Reason").fill("Passed in-class assessment");
    await pd.getByRole("button", { name: "Promote" }).click();
    await expect(pd).toBeHidden();

    await expect(panel.getByLabel("Yellow", { exact: true })).toBeVisible();
    await panel.getByText("Rank history").click();
    const history = panel.getByRole("list", { name: `${programName} history` });
    await expect(history).toContainText("Promoted from White to Yellow — Passed in-class assessment");
    await expect(history).toContainText("Stripe awarded");
    await expect(history).toContainText(`Signed off Spec kick ${tag}`);
  });
});
