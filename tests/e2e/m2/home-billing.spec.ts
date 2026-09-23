import { randomUUID } from "node:crypto";
import { addDaysStr } from "@koryo/billing";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";
import { connectRidgeline, disconnectRidgeline, stripeLive } from "../support/stripe";

const R = sid("tenant:ridgeline");
const COOPER = sid("household:ridgeline:cooper");
const LEO = sid("person:ridgeline:leo-cooper");
const PLAN = randomUUID();
const PLAN_NAME = `Spec Home Plan ${PLAN.slice(0, 6)}`;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
let membership = "";
let invoice = "";
let paidInvoice = "";

test.beforeAll(async () => {
  await sql`insert into public.membership_plans (id, tenant_id, name, kind, interval, price_cents, active) values (${PLAN}, ${R}, ${PLAN_NAME}, 'recurring', 'month', 16900, false)`;
  membership = (await sql<{ id: string }[]>`insert into public.memberships (tenant_id, household_id, person_id, plan_id, status, starts_at, billing_day, next_bill_at, notes)
    values (${R}, ${COOPER}, ${LEO}, ${PLAN}, 'active', ${today}, 1, ${addDaysStr(today, 30)}, 'home-billing spec') returning id`)[0]?.id ?? "";
  const mkInvoice = async (total: number) => {
    const [n] = await sql<{ n: string }[]>`select app.next_counter(${R}, 'invoice') as n`;
    const [i] = await sql<{ id: string }[]>`insert into public.invoices (tenant_id, household_id, person_id, membership_id, number, subtotal_cents, total_cents, due_at, source)
      values (${R}, ${COOPER}, ${LEO}, ${membership}, ${n?.n ?? 0}, ${total}, ${total}, ${addDaysStr(today, 5)}, 'manual') returning id`;
    await sql`insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents) values (${R}, ${i?.id ?? ""}, 'fee', 'Spec line', 1, ${total}, ${total})`;
    return i?.id ?? "";
  };
  invoice = await mkInvoice(4500);
  paidInvoice = await mkInvoice(2000);
  const [p] = await sql<{ id: string }[]>`insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status) values (${R}, ${COOPER}, ${paidInvoice}, 2000, 'cash', 'succeeded') returning id`;
  await sql`insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (${R}, ${p?.id ?? ""}, ${paidInvoice}, 2000)`;
});

test.afterAll(async () => {
  await sql`delete from public.tasks where related_id = ${membership}`;
  await sql`delete from public.payments where invoice_id in (select id from public.invoices where membership_id = ${membership})`;
  await sql`delete from public.invoices where membership_id = ${membership}`;
  await sql`delete from public.memberships where id = ${membership}`;
  await sql`delete from public.membership_plans where id = ${PLAN}`;
});

test.describe("@m2 Home billing", () => {
  test("parent sees balance, invoices, membership and receipts; requests a hold that staff apply", async ({ browser }) => {
    const parent = await (await browser.newContext({ storageState: authState("ridgeline", "parent") })).newPage();
    await parent.goto(`/home/wallet?invoice=${invoice}`);
    await expect(parent).toHaveURL(new RegExp(`/home/billing\\?invoice=${invoice}`));
    const toPay = parent.getByRole("list", { name: "Invoices to pay" });
    await expect(toPay.getByRole("listitem").filter({ hasText: "$45.00" })).toBeVisible();
    if (!stripeLive) await expect(parent.getByText("Online card payments aren't available yet — you can pay at the front desk.")).toBeVisible();
    const leo = parent.getByRole("listitem", { name: new RegExp(`${PLAN_NAME} for Leo Cooper`) });
    await expect(leo).toContainText("active");
    // Autopay needs a saved card: the switch is enabled exactly when the household has one.
    const [cards] = await sql<{ n: number }[]>`select count(*)::int as n from public.payment_methods where household_id = ${COOPER} and status = 'active'`;
    if (cards?.n) await expect(leo.getByRole("switch", { name: /Autopay/ })).toBeEnabled();
    else await expect(leo.getByRole("switch", { name: /Autopay/ })).toBeDisabled();
    await expectNoSeriousA11yViolations(parent);

    await parent.getByRole("list", { name: "Payments" }).getByRole("link", { name: "Receipt" }).first().click();
    await expect(parent.getByRole("heading", { level: 1, name: "Receipt" })).toBeVisible();
    await expect(parent.getByText("Spec line")).toBeVisible();
    await parent.goBack();

    await leo.getByRole("button", { name: "Request a hold" }).click();
    await parent.getByLabel("From").fill(addDaysStr(today, 3));
    await parent.getByLabel("Until").fill(addDaysStr(today, 17));
    await parent.getByLabel("Reason (optional)").fill("Family trip");
    await parent.getByRole("button", { name: "Send request" }).click();
    await expect(parent.getByRole("dialog")).toBeHidden();

    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto("/desk");
    const task = desk.getByRole("list", { name: "Open tasks" }).getByRole("listitem", { name: /Hold request: Leo Cooper/ });
    await expect(task).toContainText("Family trip");
    await task.getByRole("button", { name: "Apply hold" }).click();
    await desk.getByRole("button", { name: "Schedule hold" }).click();
    await expect(desk.getByRole("dialog")).toBeHidden();
    await expect(desk.getByRole("listitem", { name: /Hold request: Leo Cooper/ })).toHaveCount(0);
    const [m] = await sql<{ hold_from: string; hold_until: string }[]>`select hold_from::text, hold_until::text from public.memberships where id = ${membership}`;
    expect(m).toEqual({ hold_from: addDaysStr(today, 3), hold_until: addDaysStr(today, 17) });
    await parent.reload();
    await expect(parent.getByRole("listitem", { name: new RegExp(`${PLAN_NAME} for Leo Cooper`) })).toContainText(`on hold ${addDaysStr(today, 3)}`);
  });

  test("@stripe parent pays an open invoice with a test card → Desk shows paid", async ({ browser }) => {
    test.skip(!stripeLive || !process.env.STRIPE_WEBHOOK_SECRET, "needs Stripe test keys, a connected account and `stripe listen` forwarding webhooks");
    await connectRidgeline();
    try {
      const parent = await (await browser.newContext({ storageState: authState("ridgeline", "parent") })).newPage();
      await parent.goto("/home/billing");
      await parent.getByRole("listitem", { name: /Invoice/ }).filter({ hasText: "$45.00" }).getByRole("button", { name: "Pay now" }).click();
      const frame = parent.frameLocator('iframe[title*="Secure payment input"]').first();
      await frame.locator('input[name="number"]').fill("4242424242424242");
      await frame.locator('input[name="expiry"]').fill("12 / 34");
      await frame.locator('input[name="cvc"]').fill("123");
      const zip = frame.locator('input[name="postalCode"]');
      if (await zip.count()) await zip.fill("22150");
      await parent.getByRole("button", { name: /^Pay \$45\.00/ }).click();
      await expect(parent.getByRole("status")).toContainText("Payment processing");
      await expect.poll(async () => (await sql<{ status: string }[]>`select status from public.invoices where id = ${invoice}`)[0]?.status, { timeout: 30_000 }).toBe("paid");
      const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
      await desk.goto(`/desk/billing/invoices/${invoice}`);
      await expect(desk.getByText("paid", { exact: true }).first()).toBeVisible();
    } finally {
      await disconnectRidgeline();
    }
  });
});
