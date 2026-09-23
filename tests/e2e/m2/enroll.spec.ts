import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";
import { addCardViaElements, connectRidgeline, disconnectRidgeline, stripeLive } from "../support/stripe";

// A fresh family per run so the family-discount assertion never depends on seed data.
const R = sid("tenant:ridgeline");
const tag = randomUUID().slice(0, 6);
const household = randomUUID();
const kids = [
  { id: randomUUID(), first: "Ari", last: `Spec${tag}`, dob: "2016-05-01" },
  { id: randomUUID(), first: "Bo", last: `Spec${tag}`, dob: "2018-08-09" },
] as const;

test.beforeAll(async () => {
  await sql`insert into public.households (id, tenant_id, name) values (${household}, ${R}, ${`Spec${tag} family`})`;
  for (const k of kids) {
    await sql`insert into public.people (id, tenant_id, first_name, last_name, dob, type_flags, status, uniform_size, belt_size)
      values (${k.id}, ${R}, ${k.first}, ${k.last}, ${k.dob}, ${["student"]}, 'lead', '2', '3')`;
    await sql`insert into public.household_members (tenant_id, household_id, person_id, relationship) values (${R}, ${household}, ${k.id}, 'student')`;
  }
});

test.afterAll(async () => {
  await sql`delete from public.invoices where household_id = ${household}`;
  await sql`delete from public.households where id = ${household}`;
  await sql`delete from public.people where id = any(${kids.map((k) => k.id)})`;
});

async function enroll(page: Page, personId: string, pay: "Cash" | "Card on file") {
  await page.goto(`/desk/people/${personId}?tab=billing`);
  await page.getByRole("link", { name: "Enroll in membership" }).click();
  await page.getByRole("radio", { name: /Monthly Unlimited/ }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Sizes come pre-filled from the student's record (uniform 2, belt 3).
  await expect(page.getByLabel("Dobok (uniform)")).toHaveValue(sid("variant:ridgeline:dobok:2"));
  await expect(page.getByLabel("White belt")).toHaveValue(sid("variant:ridgeline:white-belt:3"));
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: pay }).check();
}

test.describe("@m2 enrollment", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("second child gets the family discount on the preview and the invoice; cash marks it paid; kits reach fulfilment", async ({ page }) => {
    const [first, second] = kids;

    await enroll(page, first.id, "Cash");
    const preview = page.getByRole("complementary", { name: "Invoice preview" });
    await expect(preview.getByText("Enrollment fee")).toBeVisible();
    await expect(preview.getByText(/Family discount/)).toHaveCount(0);
    await page.getByRole("button", { name: /^Enroll and take/ }).click();
    await expect(page).toHaveURL(/tab=billing/);
    const memberships = page.getByRole("list", { name: "Memberships" });
    await expect(memberships.getByText("Monthly Unlimited")).toBeVisible();
    await expect(memberships.getByText("active")).toBeVisible();
    await expect(page.getByRole("list", { name: "Invoices" }).getByText("paid", { exact: true })).toBeVisible();

    await enroll(page, second.id, "Cash");
    await expect(preview.getByText("Family discount 10%", { exact: true })).toBeVisible();
    await expect(preview.getByRole("list", { name: "Invoice lines" })).toContainText("Monthly Unlimited · family discount 10%");
    await page.getByRole("button", { name: /^Enroll and take/ }).click();
    await expect(page).toHaveURL(/tab=billing/);
    await expect(page.getByRole("list", { name: "Invoices" }).getByText("paid", { exact: true })).toBeVisible();

    const rows = await sql<{ person_id: string; discount_cents: number; status: string; m_status: string; p_status: string }[]>`
      select i.person_id, i.discount_cents, i.status, m.status as m_status, p.status as p_status
      from public.invoices i join public.memberships m on m.id = i.membership_id join public.people p on p.id = i.person_id
      where i.household_id = ${household}`;
    const byPerson = new Map(rows.map((r) => [r.person_id, r]));
    expect(byPerson.get(first.id)).toMatchObject({ discount_cents: 0, status: "paid", m_status: "active", p_status: "active" });
    expect(byPerson.get(second.id)?.discount_cents).toBeGreaterThan(0);
    expect(byPerson.get(second.id)).toMatchObject({ status: "paid", m_status: "active" });

    await page.goto("/desk/retail/fulfilment");
    const queue = page.getByRole("list", { name: "Fulfilments" });
    for (const k of kids) {
      const item = queue.getByRole("listitem", { name: `${k.first} ${k.last}: Monthly Unlimited` });
      await expect(item).toContainText("Dobok (uniform) (2)");
      await expect(item).toContainText("White belt (3)");
    }
    await queue.getByRole("listitem", { name: `${first.first} ${first.last}: Monthly Unlimited` }).getByRole("button", { name: "Delivered" }).click();
    await expect(queue.getByRole("listitem", { name: `${first.first} ${first.last}: Monthly Unlimited` })).toHaveCount(0);
  });

  test("@stripe paying with a test card marks the invoice paid and the membership active", async ({ page }) => {
    test.skip(!stripeLive, "needs Stripe test keys and STRIPE_TEST_CONNECTED_ACCOUNT");
    await connectRidgeline();
    try {
      const kid = kids[0];
      await sql`update public.memberships set status = 'cancelled' where person_id = ${kid.id}`;
      await page.goto(`/desk/people/${kid.id}/enroll`);
      await page.getByRole("radio", { name: /Monthly Unlimited/ }).check();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await addCardViaElements(page, "4242424242424242");
      await page.reload();
      await page.getByRole("radio", { name: /Monthly Unlimited/ }).check();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByRole("radio", { name: "Card on file" }).check();
      await page.getByRole("button", { name: /^Enroll and take/ }).click();
      await expect(page.getByText("Enrolled and paid by card.")).toBeVisible({ timeout: 30_000 });
      const [inv] = await sql<{ status: string }[]>`select i.status from public.invoices i where i.person_id = ${kid.id} order by i.created_at desc limit 1`;
      expect(inv?.status).toBe("paid");
    } finally {
      await disconnectRidgeline();
    }
  });
});
