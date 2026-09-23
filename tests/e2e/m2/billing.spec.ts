import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const PLAN = sid("plan:ridgeline:monthly-unlimited");
const tag = randomUUID().slice(0, 6);
const householdName = `Billspec${tag} family`;
const household = randomUUID();
const kid = randomUUID();
const membership = randomUUID();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

test.beforeAll(async () => {
  await sql`insert into public.households (id, tenant_id, name) values (${household}, ${R}, ${householdName})`;
  await sql`insert into public.people (id, tenant_id, first_name, last_name, type_flags) values (${kid}, ${R}, 'Casey', ${`Billspec${tag}`}, ${["student"]})`;
  await sql`insert into public.household_members (tenant_id, household_id, person_id, relationship) values (${R}, ${household}, ${kid}, 'student')`;
  await sql`insert into public.memberships (id, tenant_id, household_id, person_id, plan_id, status, starts_at, billing_day, next_bill_at)
    values (${membership}, ${R}, ${household}, ${kid}, ${PLAN}, 'active', ${today}, 1, ${today})`;
});

test.afterAll(async () => {
  await sql`delete from public.invoices where household_id = ${household}`;
  await sql`delete from public.households where id = ${household}`;
  await sql`delete from public.people where id = ${kid}`;
});

test.describe("@m2 billing run & AR", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("billing_run invoices due memberships; cash payment → paid; partial refund → partially_refunded with a credit note", async ({ page }) => {
    const run = await page.request.post(`/api/jobs/billing_run?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(run.ok()).toBe(true);
    const again = await page.request.post(`/api/jobs/billing_run?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(again.ok()).toBe(true);
    const invoices = await sql<{ id: string; total_cents: number }[]>`select id, total_cents from public.invoices where membership_id = ${membership}`;
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.total_cents).toBe(16900);

    await page.goto("/desk/billing");
    await expectNoSeriousA11yViolations(page);
    await page.goto(`/desk/billing/invoices?status=unpaid&q=${encodeURIComponent(`Billspec${tag}`)}`);
    await expectNoSeriousA11yViolations(page);
    await page.getByRole("link", { name: /^#\d+$/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /Invoice #\d+/ })).toBeVisible();
    await expect(page.getByText("open", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Take payment" }).click();
    await page.getByRole("radio", { name: "Cash" }).check();
    await expect(page.getByLabel("Amount")).toHaveValue("169.00");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("paid", { exact: true }).first()).toBeVisible();

    const payments = page.getByRole("list", { name: "Payments" });
    await payments.getByRole("button", { name: "Refund" }).click();
    await page.getByLabel("Amount").fill("50.00");
    await page.getByLabel("Reason").fill("Missed two weeks");
    await page.getByRole("button", { name: "Refund", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(payments.getByText("partially refunded")).toBeVisible();
    await expect(page.getByRole("list", { name: "Timeline" })).toContainText(/Credit note CN-\d+: \$50\.00/);
    await expect(page.getByText("partially paid", { exact: true })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    const [p] = await sql<{ status: string; refunded_cents: number }[]>`select p.status, p.refunded_cents from public.payments p join public.invoices i on i.id = p.invoice_id where i.membership_id = ${membership}`;
    expect(p).toEqual({ status: "partially_refunded", refunded_cents: 5000 });
  });

  test("add a line, then email a receipt (Outbox without a provider)", async ({ page }) => {
    const [inv] = await sql<{ id: string }[]>`select id from public.invoices where membership_id = ${membership}`;
    await page.goto(`/desk/billing/invoices/${inv?.id}`);
    await page.getByRole("button", { name: "Add line" }).click();
    await page.getByLabel("Description").fill("Testing fee");
    await page.getByLabel("Amount").fill("45");
    await page.getByRole("button", { name: "Add line" }).last().click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("cell", { name: /Testing fee/ })).toBeVisible();
    await page.getByRole("button", { name: "Email receipt" }).click();
    await expect(page.getByRole("list", { name: "Timeline" })).toContainText(/Receipt email/);
  });
});
