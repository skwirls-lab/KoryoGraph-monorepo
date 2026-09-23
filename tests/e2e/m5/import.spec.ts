import path from "node:path";
import type { Page } from "@playwright/test";
import { createTenantWithOwner, sql } from "../../db/harness";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";
import { loginWithPassword } from "../support/login";

const SAMPLE = path.join(process.cwd(), "tests/fixtures/import/spark-sample.csv");
const OTHER = path.join(process.cwd(), "tests/fixtures/import/other-vendor.csv");

async function upload(page: Page, file: string): Promise<void> {
  await page.goto("/desk/people/import");
  await page.getByLabel("CSV file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload" }).click();
  await page.waitForURL(/\/desk\/people\/import\/[0-9a-f-]{36}$/);
}

async function checkAndImport(page: Page, summary: string): Promise<void> {
  await page.getByRole("button", { name: "Check the file" }).click();
  await expect(page.getByTestId("import-summary")).toContainText(summary);
  await page.getByRole("button", { name: /^Import \d+ rows$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "new people" })).toBeVisible({ timeout: 60_000 });
}

test.describe("@m5 imports", () => {
  test("200-row Spark export → 200 students, households by guardian email, ranks set; re-import is idempotent; rollback; AI mapping for an unknown layout", async ({ page }) => {
    test.setTimeout(240_000);
    const { tenantId, ownerEmail } = await createTenantWithOwner("Import Test Dojo");
    await sql`insert into membership_plans (tenant_id, name, kind, interval, price_cents) values (${tenantId}, 'Unlimited Monthly', 'recurring', 'month', 14900)`;
    await loginWithPassword(page, ownerEmail);
    const counts = async () => (await sql<{ students: number; guardians: number; households: number; ranked: number; memberships: number }[]>`
      select (select count(*)::int from people where tenant_id = ${tenantId} and 'student' = any (type_flags) and external_id like 'SP-%') as students,
             (select count(*)::int from people where tenant_id = ${tenantId} and type_flags = '{guardian}') as guardians,
             (select count(*)::int from households where tenant_id = ${tenantId}) as households,
             (select count(*)::int from enrollments e join people p on p.id = e.person_id where e.tenant_id = ${tenantId} and p.external_id like 'SP-%' and e.current_rank_id is not null) as ranked,
             (select count(*)::int from memberships where tenant_id = ${tenantId}) as memberships`)[0];

    // 1. Upload: the Spark layout is recognised and every column mapped.
    await upload(page, SAMPLE);
    await expect(page.getByRole("combobox").filter({ hasText: "Spark Membership" })).toHaveValue("spark");
    await expect(page.getByLabel("Import Parent/Guardian Email as")).toHaveValue("guardian_email");
    await expect(page.getByLabel("Import Current Rank as")).toHaveValue("rank");
    await expectNoSeriousA11yViolations(page);
    await checkAndImport(page, "200 of 200 rows are ready: 200 new");

    // 2. 200 students; siblings share their guardian's household; every rank resolved.
    const first = await counts();
    const guardianEmails = 124;
    expect(first?.students).toBe(200);
    expect(first?.guardians).toBe(guardianEmails);
    expect(first?.ranked).toBe(200);
    const [siblings] = await sql<{ n: number }[]>`
      select count(*)::int as n from households h where h.tenant_id = ${tenantId}
        and (select count(*) from household_members m where m.household_id = h.id and m.relationship = 'student') > 1`;
    expect(siblings?.n).toBeGreaterThan(20);
    const [okafor] = await sql<{ same: boolean }[]>`
      select count(distinct m.household_id) = 1 as same from people p join household_members m on m.person_id = p.id where p.external_id in ('SP-1001', 'SP-1002')`;
    expect(okafor?.same).toBe(true);
    const [rank] = await sql<{ name: string }[]>`select r.name from people p join enrollments e on e.person_id = p.id join ranks r on r.id = e.current_rank_id where p.external_id = 'SP-1002'`;
    expect(rank?.name).toBe("Blue belt (5th gup)");
    expect(first?.memberships).toBeGreaterThan(100); // active rows on an existing plan; nothing back-billed
    const [billed] = await sql<{ n: number }[]>`select count(*)::int as n from invoices where tenant_id = ${tenantId}`;
    expect(billed?.n).toBe(0);

    // 3. The same file again changes nothing.
    await upload(page, SAMPLE);
    await checkAndImport(page, "200 of 200 rows are ready: 0 new, 200 already here");
    expect(await counts()).toEqual(first);

    // 4. Roll back the first import: everything it created is gone.
    await page.goto("/desk/people/import");
    const past = page.getByRole("list", { name: "Past imports" }).getByRole("listitem");
    await expect(past).toHaveCount(2);
    page.once("dialog", (d) => void d.accept());
    await past.last().getByRole("button", { name: "Roll back" }).click();
    await expect(page.getByText(/Rolled back: \d+ people, \d+ households removed/)).toBeVisible();
    expect(await counts()).toEqual({ students: 0, guardians: 0, households: 0, ranked: 0, memberships: 0 });

    // 5. An unknown layout: the AI suggests the mapping from the column names (dev fixture without a key).
    await upload(page, OTHER);
    await expect(page.getByRole("combobox").filter({ hasText: "Another system" })).toHaveValue("generic");
    await page.getByRole("button", { name: "Suggest with AI" }).click();
    await expect(page.getByLabel("Import Mum or Dad email as")).toHaveValue("guardian_email");
    await expect(page.getByLabel("Import Belt colour as")).toHaveValue("rank");
    await checkAndImport(page, "3 of 3 rows are ready: 3 new");
    const [moreno] = await sql<{ kids: number }[]>`
      select count(*)::int as kids from household_members m join people g on g.id = m.person_id
      where m.household_id = (select m2.household_id from household_members m2 join people p on p.id = m2.person_id where p.tenant_id = ${tenantId} and p.email = 'maria.moreno@example.test')
        and m.relationship = 'student'`;
    expect(moreno?.kids).toBe(2);
  });
});
