import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const LOC = sid("location:ridgeline:main");
const tag = randomUUID().slice(0, 6);
const last = `Spec${tag}`;
const email = `pat.${tag}@example.test`;
const className = `Trial Spec ${tag}`;
let sessionId = "";
let programId = "";

const leadState = async () => (await sql<{ key: string; n: number }[]>`
  select st.key, (select count(*)::int from leads l2 join people p2 on p2.id = l2.person_id where p2.last_name = ${last}) as n
  from leads l join pipeline_stages st on st.id = l.stage_id join people p on p.id = l.person_id where p.last_name = ${last}`)[0];

test.beforeAll(async () => {
  const [p] = await sql<{ id: string }[]>`select id from programs where tenant_id = ${R} and active order by sort limit 1`;
  programId = p?.id ?? "";
  const start = new Date(Date.now() + 60 * 60_000);
  const [s] = await sql<{ id: string }[]>`
    insert into class_sessions (tenant_id, location_id, name, program_ids, occurrence_date, starts_at, ends_at, capacity, bookable)
    values (${R}, ${LOC}, ${className}, ${programId ? [programId] : []}, (${start}::timestamptz at time zone 'America/New_York')::date, ${start}, ${new Date(start.getTime() + 3600_000)}, 20, true)
    returning id`;
  sessionId = s?.id ?? "";
});

test.afterAll(async () => {
  const people = await sql<{ id: string }[]>`select id from people where last_name = ${last}`;
  const ids = people.map((x) => x.id);
  await sql`delete from invoices where household_id in (select household_id from household_members where person_id = any(${ids}))`;
  await sql`delete from households where id in (select household_id from household_members where person_id = any(${ids}))`;
  await sql`delete from people where id = any(${ids})`;
  await sql`delete from class_sessions where id = ${sessionId}`;
});

test.describe("@m3 CRM pipeline & trials", () => {
  test("public form → New → drag to Trial scheduled (booked) → attend on the Mat → Trial attended → convert → member; duplicate email merges", async ({ browser }) => {
    test.setTimeout(120_000);
    // 1. Public trial form (no login), with UTM attribution.
    const anon = await (await browser.newContext()).newPage();
    await anon.goto("/s/ridgeline/trial?utm_source=flyer&utm_campaign=fall");
    await expectNoSeriousA11yViolations(anon);
    await anon.getByLabel("First name").fill("Pat");
    await anon.getByLabel("Last name").fill(last);
    await anon.getByLabel("Email").fill(email);
    await anon.getByRole("button", { name: "Request my trial" }).click();
    await expect(anon.getByRole("status")).toContainText("Thanks, Pat!");
    expect(await leadState()).toEqual({ key: "new", n: 1 });
    const [person] = await sql<{ utm: Record<string, string>; status: string }[]>`select utm, status from people where last_name = ${last}`;
    expect(person).toEqual({ utm: { utm_source: "flyer", utm_campaign: "fall" }, status: "lead" });

    // 2. The same email again merges into the same lead.
    await anon.goto("/s/ridgeline/trial");
    await anon.getByLabel("First name").fill("Pat");
    await anon.getByLabel("Email").fill(email.toUpperCase());
    await anon.getByLabel("Anything we should know?").fill("Can my brother come too?");
    await anon.getByRole("button", { name: "Request my trial" }).click();
    await expect(anon.getByRole("status")).toContainText("Thanks");
    expect(await leadState()).toEqual({ key: "new", n: 1 });
    const [acts] = await sql<{ n: number }[]>`select count(*)::int as n from lead_activities a join leads l on l.id = a.lead_id join people p on p.id = l.person_id where p.last_name = ${last} and a.kind = 'form'`;
    expect(acts?.n).toBe(2);

    // 3. Desk: drag the card from New to Trial scheduled → book a real class.
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner"), viewport: { width: 1600, height: 1000 } })).newPage();
    await desk.goto("/desk/crm");
    const card = desk.getByRole("listitem", { name: `Pat ${last}` });
    await expect(desk.getByRole("list", { name: "New leads" }).getByRole("listitem", { name: `Pat ${last}` })).toBeVisible();
    await expectNoSeriousA11yViolations(desk);
    const handle = card.getByRole("button", { name: `Drag Pat ${last}` });
    const target = desk.getByRole("list", { name: "Trial scheduled leads" });
    const from = await handle.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("board not laid out");
    await desk.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await desk.mouse.down();
    await desk.mouse.move(from.x + 40, from.y + 10, { steps: 5 });
    await desk.mouse.move(to.x + to.width / 2, to.y + 40, { steps: 15 });
    await desk.mouse.up();
    const dialog = desk.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Book a trial class" })).toBeVisible();
    await dialog.getByLabel("Class").selectOption({ label: (await dialog.getByLabel("Class").locator("option", { hasText: className }).textContent()) ?? "" });
    await dialog.getByRole("button", { name: "Book trial" }).click();
    await expect(desk.getByRole("list", { name: "Trial scheduled leads" }).getByRole("listitem", { name: `Pat ${last}` })).toBeVisible();
    expect((await leadState())?.key).toBe("trial_scheduled");
    const [booking] = await sql`select b.status, b.source from bookings b join people p on p.id = b.person_id where p.last_name = ${last} and b.session_id = ${sessionId}`;
    expect(booking).toEqual({ status: "booked", source: "trial" });

    // 4. The instructor checks the trial student in on the Mat → Trial attended automatically.
    const mat = await (await browser.newContext({ storageState: authState("ridgeline", "instructor"), viewport: { width: 390, height: 844 } })).newPage();
    await mat.goto(`/mat/session/${sessionId}`);
    await mat.getByRole("list", { name: "Roster" }).getByRole("button", { name: new RegExp(`^Pat ${last}, not checked in`) }).click();
    await expect(mat.getByRole("button", { name: `Pat ${last}, present` })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await leadState())?.key).toBe("trial_attended");

    // 5. Convert → enrollment wizard → member; the lead is won.
    await desk.reload();
    await desk.getByRole("link", { name: `Pat ${last}` }).click();
    await expect(desk.getByRole("list", { name: "Activity" })).toContainText("Attended a trial class");
    await desk.getByRole("button", { name: "Convert to member" }).click();
    await expect(desk.getByRole("heading", { level: 1, name: "Enroll in membership" })).toBeVisible();
    await desk.getByRole("radio", { name: /Twice Weekly/ }).check();
    await desk.getByRole("button", { name: "Next", exact: true }).click();
    // Twice Weekly includes an enrollment kit: choose sizes once the quote has loaded them.
    await desk.getByLabel("Dobok (uniform)").selectOption({ index: 1 });
    await desk.getByLabel("White belt").selectOption({ index: 1 });
    await desk.getByRole("button", { name: "Next", exact: true }).click();
    await desk.getByRole("radio", { name: "Cash" }).check();
    await desk.getByRole("button", { name: /^Enroll and take/ }).click();
    await expect(desk).toHaveURL(/tab=billing/);
    await expect(desk.getByRole("list", { name: "Memberships" })).toContainText("active");
    expect((await leadState())?.key).toBe("won");
    const [p2] = await sql`select status from people where last_name = ${last}`;
    expect(p2?.status).toBe("active");
  });
});
