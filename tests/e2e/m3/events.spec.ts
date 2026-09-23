import { randomUUID } from "node:crypto";
import { addDaysStr } from "@koryo/billing";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const tag = randomUUID().slice(0, 6);
const camp = `Spec camp ${tag}`;
const party = `Spec party ${tag}`;
const waiver = `Spec camp waiver ${tag}`;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
// The Monday at least a week out: a Mon–Wed camp.
const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
const monday = addDaysStr(today, 7 + ((8 - dow) % 7));
let partyId = "";

test.beforeAll(async () => {
  await sql`insert into document_templates (tenant_id, kind, name, body) values (${R}, 'waiver', ${waiver}, 'I allow {{student_name}} to take part in camp activities at {{school_name}}.')`;
  const [p] = await sql<{ id: string }[]>`insert into events (tenant_id, kind, name, starts_at, ends_at, pricing, deposit_cents, host_household_id)
    values (${R}, 'party', ${party}, now() + interval '5 days', now() + interval '5 days 2 hours', '[]'::jsonb, 10000, (select household_id from household_members where person_id = ${MAYA} limit 1)) returning id`;
  partyId = p?.id ?? "";
  await sql`insert into event_days (tenant_id, event_id, date, starts_at, ends_at) select tenant_id, id, (starts_at at time zone 'America/New_York')::date, starts_at, ends_at from events where id = ${partyId}`;
});

test.afterAll(async () => {
  await sql`delete from invoices where id in (select r.invoice_id from event_registrations r join events e on e.id = r.event_id where e.name in (${camp}, ${party}))`;
  await sql`delete from invoices where id in (select deposit_invoice_id from events where name in (${camp}, ${party}))`;
  await sql`delete from events where name in (${camp}, ${party})`;
  await sql`delete from signatures where template_id in (select id from document_templates where name = ${waiver})`;
  await sql`delete from document_templates where name = ${waiver}`;
});

test.describe("@m3 events", () => {
  test("camp: create with 3 days → parent signs the waiver, registers 2 days → paid → capacity enforced → check-in/out with signature", async ({ browser }) => {
    test.setTimeout(120_000);
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto("/desk/events");
    await expect(desk.getByRole("table", { name: /\d{4}/ })).toBeVisible();
    await expectNoSeriousA11yViolations(desk);

    // Wizard: kind → dates → pricing → capacity & waivers → review.
    await desk.getByRole("link", { name: "New event" }).click();
    await desk.getByRole("radio", { name: "Camp" }).check();
    await desk.getByLabel("Name", { exact: true }).fill(camp);
    await expectNoSeriousA11yViolations(desk);
    await desk.getByRole("button", { name: "Next", exact: true }).click();
    await desk.getByLabel("First day").fill(monday);
    await desk.getByLabel("Last day").fill(addDaysStr(monday, 2));
    await expect(desk.getByText("3 days — families can choose days")).toBeVisible();
    await desk.getByRole("button", { name: "Next", exact: true }).click();
    await desk.getByLabel("Price").first().fill("150");
    await desk.getByLabel("Price").nth(1).fill("40");
    await desk.getByRole("button", { name: "Next", exact: true }).click();
    await desk.getByLabel("Capacity per day").fill("1");
    await desk.getByRole("checkbox", { name: waiver }).check();
    await desk.getByRole("button", { name: "Next", exact: true }).click();
    await expect(desk.getByText(/Single day \$40 per day/)).toBeVisible();
    await desk.getByRole("button", { name: "Create event" }).click();
    await expect(desk.getByRole("heading", { level: 1, name: camp })).toBeVisible();
    await expect(desk.getByRole("list", { name: "Days" }).getByRole("listitem")).toHaveCount(3);
    await expectNoSeriousA11yViolations(desk);

    // Parent: the waiver must be signed first, then register Maya for 2 of the 3 days.
    const home = await (await browser.newContext({ storageState: authState("ridgeline", "parent") })).newPage();
    await home.goto("/home/events");
    await home.getByRole("link", { name: camp }).click();
    await home.getByLabel("Student").selectOption({ label: "Maya Cooper" });
    await expect(home.getByText(`Sign first: ${waiver}`)).toBeVisible();
    await expect(home.getByRole("button", { name: "Register", exact: true })).toBeDisabled();
    await home.getByRole("link", { name: `Sign ${waiver}` }).click();
    await home.getByLabel(/I have read/).check();
    await home.getByLabel("Type your full name to sign").fill("Jordan Cooper");
    await home.getByRole("button", { name: "Sign", exact: true }).click();
    await home.waitForURL(/\/home\/documents/);
    await home.goto("/home/events");
    await home.getByRole("link", { name: camp }).click();
    await home.getByLabel("Student").selectOption({ label: "Maya Cooper" });
    await home.getByLabel("Option").selectOption({ label: "Single day — $40.00 per day" });
    await home.getByRole("checkbox", { name: /Wed/ }).uncheck();
    await expect(home.getByText("Total: $80.00 for 2 days")).toBeVisible();
    await home.getByRole("checkbox", { name: /Allergies on file for Maya Cooper/ }).check();
    await expectNoSeriousA11yViolations(home);
    await home.getByRole("button", { name: "Register", exact: true }).click();
    await expect(home.getByRole("status").filter({ hasText: "Registered — $80.00 due" })).toBeVisible();
    await home.reload();
    await expect(home.getByRole("list", { name: "Your registrations" })).toContainText("Registered — payment due");

    // Pay (cash at the desk; card from Home is the same invoice) → registration paid.
    const [reg] = await sql<{ invoice_id: string }[]>`select r.invoice_id from event_registrations r join events e on e.id = r.event_id where e.name = ${camp} and r.person_id = ${MAYA}`;
    const [inv] = await sql`select source, total_cents from invoices where id = ${reg?.invoice_id ?? ""}`;
    expect(inv).toEqual({ source: "event", total_cents: 8000 });
    await desk.goto(`/desk/billing/invoices/${reg?.invoice_id}`);
    await desk.getByRole("button", { name: "Take payment" }).click();
    await desk.getByRole("radio", { name: "Cash" }).check();
    await desk.getByRole("button", { name: "Record payment" }).click();
    await expect(desk.getByRole("dialog")).toBeHidden();
    await expect.poll(async () => (await sql`select r.status from event_registrations r join events e on e.id = r.event_id where e.name = ${camp}`)[0]?.status).toBe("paid");

    // Capacity 1 per day: Maya's two days are full for everyone else; the third is open.
    await desk.goto("/desk/events");
    await desk.getByRole("link", { name: camp }).first().click();
    await expect(desk.getByRole("row", { name: "Maya Cooper" })).toContainText("paid");
    await expect(desk.getByRole("checkbox", { name: /Mon.*full/ })).toBeDisabled();
    await expect(desk.getByRole("checkbox", { name: /Tue.*full/ })).toBeDisabled();
    await expect(desk.getByRole("checkbox", { name: /Wed.*1 left/ })).toBeEnabled();

    // Day check-in / check-out: pickup name + drawn signature, stored.
    await desk.getByRole("list", { name: "Days" }).getByRole("listitem").first().getByRole("link", { name: "Open check-in" }).click();
    const card = desk.getByRole("listitem", { name: "Maya Cooper" });
    await expect(card).toContainText("Allergies: peanuts");
    await card.getByRole("button", { name: "Check in" }).click();
    await expect(card).toContainText("Here");
    await expectNoSeriousA11yViolations(desk);
    await card.getByRole("button", { name: "Check out" }).click();
    const dialog = desk.getByRole("dialog");
    await dialog.getByLabel("Picked up by").fill("Jordan Cooper");
    await expect(dialog.getByRole("button", { name: "Confirm pickup" })).toBeDisabled();
    const box = await dialog.getByRole("img", { name: "Pickup signature" }).boundingBox();
    if (!box) throw new Error("signature pad not rendered");
    await desk.mouse.move(box.x + 20, box.y + box.height / 2);
    await desk.mouse.down();
    for (let i = 1; i <= 12; i++) await desk.mouse.move(box.x + 20 + i * 15, box.y + box.height / 2 + (i % 2 ? -20 : 20));
    await desk.mouse.up();
    await dialog.getByRole("button", { name: "Confirm pickup" }).click();
    await expect(card).toContainText("Picked up by Jordan Cooper");
    const [chk] = await sql<{ pickup_person_name: string; signature_path: string }[]>`select c.pickup_person_name, c.signature_path from event_checkins c join event_days d on d.id = c.event_day_id join events e on e.id = d.event_id where e.name = ${camp} and c.person_id = ${MAYA}`;
    expect(chk?.pickup_person_name).toBe("Jordan Cooper");
    const [obj] = await sql`select metadata->>'mimetype' as type from storage.objects where bucket_id = 'tenant-media' and name = ${chk?.signature_path ?? ""}`;
    expect(obj?.type).toBe("image/png");
    await expect(desk.getByRole("region", { name: "Pickup log" })).toContainText("picked up by Jordan Cooper");
  });

  test("party: deposit invoice, and the guest waiver link signs without logging in", async ({ browser }) => {
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto(`/desk/events/${partyId}`);
    await desk.getByRole("button", { name: "Invoice the deposit" }).click();
    await expect(desk.getByRole("link", { name: "$100.00 due" })).toBeVisible();
    await desk.getByRole("button", { name: "Create guest link" }).click();
    const link = await desk.getByLabel("Guest waiver link").inputValue();
    expect(link).toMatch(/\/sign\/party\/[0-9a-f]{48}$/);
    await expectNoSeriousA11yViolations(desk);

    const guest = await (await browser.newContext()).newPage();
    await guest.goto(new URL(link).pathname);
    await expect(guest.getByRole("heading", { level: 1, name: party })).toBeVisible();
    await guest.getByLabel("Guest's name").fill("Sam Guest");
    await guest.getByLabel("Parent or guardian").fill("Pat Guest");
    await guest.getByLabel("Type your full name to sign").fill("Pat Guest");
    await guest.getByRole("button", { name: "Sign waiver" }).click();
    await expect(guest.getByText("Tick the box to agree")).toBeVisible();
    await guest.getByRole("checkbox", { name: /parent or legal guardian/ }).check();
    await expectNoSeriousA11yViolations(guest);
    await guest.getByRole("button", { name: "Sign waiver" }).click();
    await expect(guest.getByRole("status")).toContainText("Signed for Sam Guest");

    await desk.reload();
    await expect(desk.getByRole("list", { name: "Signed guest waivers" })).toContainText("Sam Guest");
    const bad = await (await browser.newContext()).newPage();
    await bad.goto(`/sign/party/${"0".repeat(48)}`);
    await expect(bad.getByText("Link not valid")).toBeVisible();
  });
});
