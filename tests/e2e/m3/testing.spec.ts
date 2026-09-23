import { randomUUID } from "node:crypto";
import { addDaysStr } from "@koryo/billing";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const MAYA = sid("person:ridgeline:maya-cooper");
const name = `Spec belt test ${randomUUID().slice(0, 6)}`;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
let before: { id: string; current_rank_id: string | null; stripes: number; classes_since_promotion: number; last_promoted_at: string | null } | undefined;

test.beforeAll(async () => {
  [before] = await sql`select e.id, e.current_rank_id, e.stripes, e.classes_since_promotion, e.last_promoted_at from enrollments e join programs p on p.id = e.program_id where e.person_id = ${MAYA} and p.name = 'Youth Taekwondo'`;
});

test.afterAll(async () => {
  const [ev] = await sql<{ id: string }[]>`select id from testing_events where name = ${name}`;
  if (ev) {
    await sql`delete from invoices where id in (select invoice_id from testing_registrations where testing_event_id = ${ev.id})`;
    await sql`delete from promotions where testing_event_id = ${ev.id}`;
    await sql`delete from testing_events where id = ${ev.id}`;
  }
  if (before) await sql`update enrollments set current_rank_id = ${before.current_rank_id}, stripes = ${before.stripes}, classes_since_promotion = ${before.classes_since_promotion}, last_promoted_at = ${before.last_promoted_at} where id = ${before.id}`;
});

test.describe("@m3 belt testing", () => {
  test("create → auto-roster → invite → parent registers → fee paid → judge scores → bulk promote → certificate, Kukkiwon CSV", async ({ browser }) => {
    test.setTimeout(120_000);
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto("/desk/testing");
    await expectNoSeriousA11yViolations(desk);
    await desk.getByRole("button", { name: "New test" }).click();
    const dialog = desk.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Date").fill(addDaysStr(today, 7));
    await dialog.getByLabel("Testing fee").fill("45");
    await dialog.getByLabel("Register by").fill(addDaysStr(today, 5));
    await dialog.getByLabel("Youth Taekwondo").check();
    await dialog.getByLabel("Master Alex Kim").check();
    await dialog.getByRole("button", { name: "Create test" }).click();
    await expect(desk.getByRole("heading", { level: 1, name })).toBeVisible();

    // Roster: the engine's groups; invite only Maya (adding a reason if she isn't eligible yet).
    await expect(desk.getByRole("heading", { name: /^Eligible/ })).toBeVisible();
    const notYet = desk.getByRole("button", { name: /not yet eligible/ });
    if (await notYet.count()) await notYet.click();
    for (const box of await desk.getByRole("checkbox", { name: /^Invite / }).all()) {
      const label = await box.getAttribute("aria-label");
      if (label === "Invite Maya Cooper") await box.check();
      else await box.uncheck();
    }
    const reason = desk.getByLabel(/Reason for inviting/);
    if (await reason.count()) await reason.fill("Instructor confident");
    await desk.getByRole("button", { name: "Invite 1 selected" }).click();
    await expect(desk.getByRole("list", { name: "Registrations" }).getByRole("listitem", { name: "Maya Cooper" })).toContainText("invited");
    await expectNoSeriousA11yViolations(desk);
    const [inviteMsg] = await sql`select c.template_key from communications c join testing_events t on t.id = c.related_id where t.name = ${name}`;
    expect(inviteMsg?.template_key).toBe("test_invitation");

    // Parent sees the invitation on Home and registers → testing fee invoice.
    const home = await (await browser.newContext({ storageState: authState("ridgeline", "parent") })).newPage();
    await home.goto("/home");
    await home.getByRole("link", { name: /Maya is invited to test/ }).click();
    await home.getByRole("button", { name: "Register Maya" }).click();
    await expect(home.getByText(/Pay the \$45\.00 testing fee/)).toBeVisible();
    await expectNoSeriousA11yViolations(home);

    // The fee is paid (cash at the desk here; card from Home is the same invoice) → registration 'paid'.
    const [reg] = await sql<{ invoice_id: string }[]>`select r.invoice_id from testing_registrations r join testing_events t on t.id = r.testing_event_id where t.name = ${name}`;
    await desk.goto(`/desk/billing/invoices/${reg?.invoice_id}`);
    await desk.getByRole("button", { name: "Take payment" }).click();
    await desk.getByRole("radio", { name: "Cash" }).check();
    await desk.getByRole("button", { name: "Record payment" }).click();
    await expect(desk.getByRole("dialog")).toBeHidden();
    await expect.poll(async () => (await sql`select r.status from testing_registrations r join testing_events t on t.id = r.testing_event_id where t.name = ${name}`)[0]?.status).toBe("paid");

    // Judge scores on the scoresheet.
    await desk.goto("/desk/testing");
    await desk.getByRole("link", { name }).click();
    await desk.getByRole("link", { name: "Scoresheets" }).click();
    const card = desk.getByRole("region", { name: "Maya Cooper" });
    await card.getByRole("radio", { name: "pass" }).check();
    await card.getByRole("button", { name: "Save scores" }).click();
    await expect(desk.getByText("Saved Maya Cooper")).toBeVisible();
    await expectNoSeriousA11yViolations(desk);

    // Bulk promote → promotion + certificate.
    await desk.goBack();
    await desk.reload();
    await desk.getByRole("button", { name: "Promote 1 selected" }).click();
    await expect(desk.getByText("Promoted 1 · 1 certificate ready")).toBeVisible();
    const [promo] = await sql<{ certificate_path: string; to_rank: string }[]>`select p.certificate_path, r.name as to_rank from promotions p join ranks r on r.id = p.to_rank_id join testing_events t on t.id = p.testing_event_id where t.name = ${name}`;
    expect(promo?.certificate_path).toMatch(/\/certificates\/.+\.pdf$/);
    const zip = await desk.request.get(`${desk.url()}/certificates`);
    expect(zip.status()).toBe(200);
    expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
    const [enr] = await sql<{ rank: string; stripes: number; classes_since_promotion: number }[]>`select r.name as rank, e.stripes, e.classes_since_promotion from enrollments e join ranks r on r.id = e.current_rank_id where e.id = ${before?.id ?? ""}`;
    expect(enr).toEqual({ rank: promo?.to_rank, stripes: 0, classes_since_promotion: 0 });
    const [congrats] = await sql`select template_key from communications where related_type = 'promotion' and template_key = 'promotion_congrats' order by created_at desc limit 1`;
    expect(congrats?.template_key).toBe("promotion_congrats");

    // Rank history on Home progress.
    await home.goto("/home/progress");
    await expect(home.getByText(new RegExp(`to ${promo?.to_rank.replace(/[()]/g, ".")}`)).first()).toBeVisible();

    // Kukkiwon export columns.
    const csv = await desk.request.get(`${desk.url()}/export?format=kukkiwon`);
    expect((await csv.text()).split(/\r?\n/)[0]).toBe("name_en,name_kr,nationality,dob,address,current_poom_dan,applying_for,test_date,instructor,photo_path,tcon_id");
  });
});
