import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { addDaysStr } from "@koryo/billing";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";
import { addCardViaElements, connectRidgeline, disconnectRidgeline, stripeLive } from "../support/stripe";

const R = sid("tenant:ridgeline");
const PLAN = sid("plan:ridgeline:monthly-unlimited");
const tag = randomUUID().slice(0, 6);
const householdName = `Dunspec${tag} family`;
const household = randomUUID();
const guardian = randomUUID();
const kid = randomUUID();
const membership = randomUUID();
const invoice = randomUUID();
const D0 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

async function runDunning(request: APIRequestContext, day: number) {
  const now = `${addDaysStr(D0, day)}T15:00:00Z`; // 11:00 in New York
  const res = await request.post(`/api/jobs/dunning?tenant=${R}&now=${encodeURIComponent(now)}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok(), await res.text()).toBe(true);
}
const notices = () => sql<{ template_key: string; channel: string }[]>`select template_key, channel from public.communications where related_type = 'invoice' and related_id = ${invoice} order by created_at, channel`;
const membershipStatus = async () => (await sql<{ status: string }[]>`select status from public.memberships where id = ${membership}`)[0]?.status;

test.beforeAll(async () => {
  await sql`insert into public.households (id, tenant_id, name, primary_payer_person_id) values (${household}, ${R}, ${householdName}, null)`;
  await sql`insert into public.people (id, tenant_id, first_name, last_name, type_flags, status, email, phone, email_consent, phone_sms_consent)
    values (${guardian}, ${R}, 'Dana', ${`Dunspec${tag}`}, ${["guardian"]}, 'guardian_only', ${`dana.${tag}@example.test`}, '(555) 010-9911', true, true)`;
  await sql`insert into public.people (id, tenant_id, first_name, last_name, dob, type_flags) values (${kid}, ${R}, 'Eli', ${`Dunspec${tag}`}, '2016-02-02', ${["student"]})`;
  await sql`insert into public.household_members (tenant_id, household_id, person_id, relationship, is_primary_guardian) values (${R}, ${household}, ${guardian}, 'guardian', true), (${R}, ${household}, ${kid}, 'student', false)`;
  await sql`update public.households set primary_payer_person_id = ${guardian} where id = ${household}`;
  await sql`insert into public.memberships (id, tenant_id, household_id, person_id, plan_id, status, starts_at, billing_day, next_bill_at, autopay)
    values (${membership}, ${R}, ${household}, ${kid}, ${PLAN}, 'active', ${D0}, 1, ${addDaysStr(D0, 30)}, true)`;
  const [n] = await sql<{ n: string }[]>`select app.next_counter(${R}, 'invoice') as n`;
  await sql`insert into public.invoices (id, tenant_id, household_id, person_id, membership_id, number, subtotal_cents, total_cents, due_at, source, dunning_state)
    values (${invoice}, ${R}, ${household}, ${kid}, ${membership}, ${n?.n ?? 0}, 16900, 16900, ${D0}, 'billing_run',
      ${sql.json({ attempts: 1, failed_on: D0, stage: 0, last_error: "Your card was declined." })})`;
});

test.afterAll(async () => {
  await sql`delete from public.communications where related_type = 'invoice' and related_id = ${invoice}`;
  await sql`delete from public.invoices where household_id = ${household}`;
  await sql`delete from public.households where id = ${household}`;
  await sql`delete from public.people where id in (${guardian}, ${kid})`;
});

test.describe("@m2 dunning", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("day 1/3/7 notices → suspension at the final step → paying clears it", async ({ page }) => {
    await runDunning(page.request, 1);
    expect(await notices()).toEqual([{ template_key: "payment_failed_1", channel: "email" }]);
    expect(await membershipStatus()).toBe("past_due");

    await runDunning(page.request, 2); // nothing due between steps
    expect(await notices()).toHaveLength(1);

    await runDunning(page.request, 3);
    expect((await notices()).slice(1)).toEqual([{ template_key: "payment_failed_2", channel: "email" }, { template_key: "payment_failed_2", channel: "sms" }]);

    await runDunning(page.request, 7);
    expect((await notices()).slice(3)).toEqual([{ template_key: "payment_failed_3", channel: "email" }, { template_key: "payment_failed_3", channel: "sms" }]);
    expect(await membershipStatus()).toBe("suspended");
    const [inv] = await sql<{ dunning_state: { stage: number; history: { results: string[] }[] } }[]>`select dunning_state from public.invoices where id = ${invoice}`;
    expect(inv?.dunning_state.stage).toBe(3);
    expect(inv?.dunning_state.history[0]?.results).toContain("retry not attempted: Stripe isn't configured on this server");

    await runDunning(page.request, 8); // steps never repeat
    expect(await notices()).toHaveLength(5);

    // The Desk worklist shows it; the outbox shows the notices honestly as unsent without a provider.
    await page.goto("/desk/billing");
    const item = page.getByRole("list", { name: "Failed payments" }).getByRole("listitem", { name: new RegExp(householdName) });
    await expect(item).toContainText("step 3");
    await expect(item).toContainText("suspended");

    // Paying the invoice (cash at the desk) ends dunning and restores the membership.
    await page.goto(`/desk/billing/invoices/${invoice}`);
    await page.getByRole("button", { name: "Take payment" }).click();
    await page.getByRole("radio", { name: "Cash" }).check();
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await membershipStatus()).toBe("active");
    const [after] = await sql<{ dunning_state: { resolved_at?: string } }[]>`select dunning_state from public.invoices where id = ${invoice}`;
    expect(after?.dunning_state.resolved_at).toBeTruthy();
    await page.goto("/desk/billing");
    await expect(page.getByRole("listitem", { name: new RegExp(householdName) })).toHaveCount(0);
  });

  test("@stripe updating the card and retrying clears it", async ({ page }) => {
    test.skip(!stripeLive, "needs Stripe test keys and STRIPE_TEST_CONNECTED_ACCOUNT");
    await connectRidgeline();
    try {
      await sql`update public.invoices set status = 'past_due', dunning_state = ${sql.json({ attempts: 1, failed_on: D0, stage: 3 })} where id = ${invoice}`;
      await sql`delete from public.payment_allocations where invoice_id = ${invoice}`;
      await sql`update public.memberships set status = 'suspended' where id = ${membership}`;
      await page.goto(`/desk/households/${household}`);
      await addCardViaElements(page, "4242424242424242");
      await page.goto("/desk/billing");
      await page.getByRole("listitem", { name: new RegExp(householdName) }).getByRole("button", { name: "Retry card" }).click();
      await expect(page.getByText("Payment succeeded")).toBeVisible({ timeout: 30_000 });
      expect(await membershipStatus()).toBe("active");
    } finally {
      await disconnectRidgeline();
    }
  });
});
