import { randomUUID } from "node:crypto";
import { addDaysStr } from "@koryo/billing";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const name = `Spec after-school ${randomUUID().slice(0, 6)}`;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
const tuesday = addDaysStr(today, 7 + ((9 - dow) % 7)); // a Tuesday more than a week out
const thursday = addDaysStr(tuesday, 2);

test.afterAll(async () => {
  const [p] = await sql<{ id: string; plan_id: string | null }[]>`select id, plan_id from afterschool_programs where name = ${name}`;
  if (!p) return;
  await sql`delete from communications where related_type = 'afterschool_attendance' and related_id in (select a.id from afterschool_attendance a join afterschool_enrollments e on e.id = a.enrollment_id where e.program_id = ${p.id})`;
  const ms = await sql<{ id: string }[]>`select membership_id as id from afterschool_enrollments where program_id = ${p.id} and membership_id is not null`;
  const ids = ms.map((m) => m.id);
  if (ids.length) {
    await sql`delete from payments where invoice_id in (select id from invoices where membership_id in ${sql(ids)})`;
    await sql`delete from invoices where membership_id in ${sql(ids)}`;
  }
  await sql`delete from afterschool_programs where id = ${p.id}`;
  if (ids.length) await sql`delete from memberships where id in ${sql(ids)}`;
  if (p.plan_id) await sql`delete from membership_plans where id = ${p.plan_id}`;
});

test.describe("@m3 after-school", () => {
  test("manifest per route and day, absence queues an alert, weekly invoice from the billing run", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto("/desk/afterschool");
    await expectNoSeriousA11yViolations(desk);
    await desk.getByRole("button", { name: "New program" }).click();
    const dialog = desk.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await dialog.getByLabel("Weekly price").fill("95");
    await dialog.getByLabel("Schools (one per line)").fill("Oak Elementary\nPine Middle");
    await dialog.getByLabel("Pickup routes (one per line)").fill("North\nSouth");
    await expectNoSeriousA11yViolations(desk);
    await dialog.getByRole("button", { name: "Create program" }).click();
    await expect(desk.getByRole("heading", { level: 1, name })).toBeVisible();

    // Maya: Oak Elementary, North, every weekday. Riley: Pine Middle, South, Thursdays only.
    await desk.getByLabel("Child", { exact: true }).selectOption({ label: "Maya Cooper" });
    await desk.getByLabel("School", { exact: true }).selectOption("Oak Elementary");
    await desk.getByLabel("Route", { exact: true }).selectOption("North");
    await desk.getByRole("button", { name: "Enroll", exact: true }).click();
    await expect(desk.getByRole("row", { name: "Maya Cooper" })).toContainText("Oak Elementary");
    await desk.getByLabel("Child", { exact: true }).selectOption({ label: "Riley Adams" });
    await desk.getByLabel("School", { exact: true }).selectOption("Pine Middle");
    await desk.getByLabel("Route", { exact: true }).selectOption("South");
    for (const d of ["Mon", "Tue", "Wed", "Fri"]) await desk.getByRole("checkbox", { name: d, exact: true }).uncheck();
    await desk.getByRole("button", { name: "Enroll", exact: true }).click();
    await expect(desk.getByRole("row", { name: "Riley Adams" })).toContainText("Thu");
    await expectNoSeriousA11yViolations(desk);

    // Tuesday: only Maya (North · Oak). Thursday: Maya on North and Riley on South.
    await desk.getByRole("link", { name: "Today's manifest" }).click();
    await desk.waitForURL(/\/manifest\?date=/);
    await desk.goto(`${new URL(desk.url()).pathname}?date=${tuesday}`);
    await expect(desk.getByRole("list", { name: "North · Oak Elementary" }).getByRole("listitem", { name: "Maya Cooper" })).toBeVisible();
    await expect(desk.getByRole("listitem", { name: "Riley Adams" })).toHaveCount(0);
    await expect(desk.getByRole("region", { name: "Route South" })).toHaveCount(0);
    await desk.goto(`${new URL(desk.url()).pathname}?date=${thursday}`);
    await expect(desk.getByRole("list", { name: "North · Oak Elementary" }).getByRole("listitem", { name: "Maya Cooper" })).toBeVisible();
    await expect(desk.getByRole("list", { name: "South · Pine Middle" }).getByRole("listitem", { name: "Riley Adams" })).toBeVisible();
    await expectNoSeriousA11yViolations(desk);

    // Mark Maya absent → a queued afterschool_absent alert to her guardians.
    const maya = desk.getByRole("listitem", { name: "Maya Cooper" });
    await maya.getByRole("button", { name: "Absent" }).click();
    await desk.getByRole("dialog").getByLabel("Reason (optional)").fill("Not at the school door");
    await desk.getByRole("button", { name: "Mark absent and alert" }).click();
    await expect(maya).toContainText("Absent · family alerted");
    const alerts = await sql`select c.status, c.channel from communications c join afterschool_attendance a on a.id = c.related_id join afterschool_enrollments e on e.id = a.enrollment_id
                             join afterschool_programs p on p.id = e.program_id where p.name = ${name} and c.template_key = 'afterschool_absent'`;
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.status === "queued")).toBe(true);

    // Riley arrives and is released with a signature.
    const riley = desk.getByRole("listitem", { name: "Riley Adams" });
    await riley.getByRole("button", { name: "Arrived" }).click();
    await expect(riley).toContainText("Here since");
    await riley.getByRole("button", { name: "Release" }).click();
    const rel = desk.getByRole("dialog");
    await rel.getByLabel("Picked up by").fill("Sam Adams");
    const box = await rel.getByRole("img", { name: "Pickup signature" }).boundingBox();
    if (!box) throw new Error("signature pad not rendered");
    await desk.mouse.move(box.x + 20, box.y + 40);
    await desk.mouse.down();
    for (let i = 1; i <= 10; i++) await desk.mouse.move(box.x + 20 + i * 18, box.y + 40 + (i % 2 ? 25 : -5));
    await desk.mouse.up();
    await rel.getByRole("button", { name: "Confirm release" }).click();
    await expect(riley).toContainText("Released");
    await expect(riley).toContainText("Sam Adams");

    // Weekly billing: today's billing run invoices Maya's weekly membership once and moves it a week on.
    const [m] = await sql<{ id: string }[]>`select e.membership_id as id from afterschool_enrollments e join afterschool_programs p on p.id = e.program_id where p.name = ${name} and e.person_id = ${MAYA}`;
    const run = async () => {
      const res = await request.post(`/api/jobs/billing_run?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
      expect(res.status()).toBe(200);
    };
    await run();
    await run();
    const invoices = await sql`select total_cents from invoices where membership_id = ${m?.id ?? ""}`;
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.total_cents).toBe(9500);
    const [next] = await sql<{ next_bill_at: string }[]>`select next_bill_at::text from memberships where id = ${m?.id ?? ""}`;
    expect(next?.next_bill_at).toBe(addDaysStr(today, 7));
  });
});
