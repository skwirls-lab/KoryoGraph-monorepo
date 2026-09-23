import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
let noConsentGuardian = "";
let absentWasActive = false;

test.beforeAll(async () => {
  // One Youth Taekwondo family's guardian withdraws email consent: broadcasts must skip them.
  const [g] = await sql<{ id: string }[]>`
    select g.id from people s join enrollments e on e.person_id = s.id and e.status = 'active' join programs p on p.id = e.program_id and p.name = 'Youth Taekwondo'
    join household_members hm on hm.person_id = s.id join household_members gm on gm.household_id = hm.household_id and gm.relationship = 'guardian'
    join people g on g.id = gm.person_id
    where s.tenant_id = ${R} and s.status = 'active' and g.email is not null and g.email_consent order by g.id limit 1`;
  noConsentGuardian = g?.id ?? "";
  const [a] = await sql<{ active: boolean }[]>`select active from automations where tenant_id = ${R} and template_key = 'absent_14'`;
  absentWasActive = a?.active ?? false;
  await sql`update people set email_consent = false where id = ${noConsentGuardian}`;
});

test.afterAll(async () => {
  await sql`update people set email_consent = true where id = ${noConsentGuardian}`;
  await sql`update automations set active = ${absentWasActive} where tenant_id = ${R} and template_key = 'absent_14'`;
});

test.describe("@m3 automations & broadcasts", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("enabling 'Absent 14 days' and running the evaluator queues messages for exactly the absent students", async ({ page }) => {
    await page.goto("/desk/automations");
    await expectNoSeriousA11yViolations(page);
    // The demo seed may already have it on; make sure it is.
    const toggle = page.getByRole("listitem", { name: "Absent 14 days" }).getByRole("switch", { name: "Absent 14 days active" });
    if ((await toggle.getAttribute("aria-checked")) !== "true") {
      await toggle.click();
      await expect(page.getByText("Absent 14 days is on")).toBeVisible();
    }
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    const run = await page.request.post(`/api/jobs/automations?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(run.ok(), await run.text()).toBe(true);

    // Truth, computed independently: active students with an active enrollment whose last class (school date) was ≥ 14 days ago.
    const expected = await sql<{ id: string }[]>`
      select p.id from people p
      where p.tenant_id = ${R} and p.archived_at is null and p.status = 'active' and 'student' = any(p.type_flags)
        and exists (select 1 from enrollments e where e.person_id = p.id and e.status = 'active')
        and coalesce(
          (select max((s.starts_at at time zone 'America/New_York')::date) from attendance a join class_sessions s on s.id = a.session_id where a.person_id = p.id and s.starts_at <= now()),
          (select min(e.started_at) from enrollments e where e.person_id = p.id and e.status = 'active')
        ) <= (now() at time zone 'America/New_York')::date - 14`;
    const runs = await sql<{ person_id: string }[]>`select r.person_id from automation_runs r join automations a on a.id = r.automation_id where a.tenant_id = ${R} and a.template_key = 'absent_14'`;
    expect(expected.length).toBeGreaterThan(0);
    expect(runs.map((r) => r.person_id).sort()).toEqual(expected.map((e) => e.id).sort());
    const comms = await sql<{ about: string; template_key: string }[]>`
      select c.data ->> 'about_person_id' as about, c.template_key from communications c join automation_runs r on r.id = c.automation_run_id join automations a on a.id = r.automation_id
      where a.template_key = 'absent_14' and a.tenant_id = ${R}`;
    expect(comms.length).toBeGreaterThan(0);
    expect(new Set(comms.map((c) => c.template_key))).toEqual(new Set(["absent_14"]));
    for (const c of comms) expect(expected.map((e) => e.id)).toContain(c.about);
    const staffTasks = await sql`select t.id from tasks t join automation_runs r on r.id = t.related_id join automations a on a.id = r.automation_id where a.template_key = 'absent_14' and a.tenant_id = ${R}`;
    expect(staffTasks.length).toBe(expected.length);

    // Running again changes nothing (one run per absence streak).
    await page.request.post(`/api/jobs/automations?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const again = await sql`select r.id from automation_runs r join automations a on a.id = r.automation_id where a.tenant_id = ${R} and a.template_key = 'absent_14'`;
    expect(again.length).toBe(expected.length);

    await page.getByRole("link", { name: "Absent 14 days" }).click();
    await expect(page.getByRole("list", { name: "Runs" }).getByRole("listitem").first()).toContainText("done");
    await expectNoSeriousA11yViolations(page);
  });

  test("broadcast to 'Youth Taekwondo, active' creates exactly the previewed number of messages; no-consent excluded", async ({ page }) => {
    await page.goto("/desk/broadcasts");
    await page.getByRole("group", { name: "Programs" }).getByLabel("Youth Taekwondo").check();
    const status = page.getByRole("status").filter({ hasText: "recipient" });
    await expect(status).toContainText("without email consent excluded");
    const n = Number(((await status.locator("strong").textContent()) ?? "0").trim());
    expect(n).toBeGreaterThan(0);
    await expectNoSeriousA11yViolations(page);
    await page.getByLabel("Internal name").fill("Spec broadcast");
    await page.getByLabel("Subject").fill("Class schedule change");
    await page.getByLabel("Message").fill("Hi {{first_name}}, Saturday classes move to 10am.");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: `Send to ${n}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Spec broadcast" })).toBeVisible();
    const comms = await sql<{ person_id: string; body_text: string }[]>`select c.person_id, c.body_text from communications c join campaigns k on k.id = c.campaign_id where k.name = 'Spec broadcast' and k.tenant_id = ${R}`;
    expect(comms).toHaveLength(n);
    expect(comms.map((c) => c.person_id)).not.toContain(noConsentGuardian);
    expect(comms.every((c) => !c.body_text.includes("{{first_name}}"))).toBe(true);
    await expect(page.getByRole("region", { name: "Delivery" }).getByText("Messages")).toBeVisible();
    await sql`delete from campaigns where name = 'Spec broadcast' and tenant_id = ${R}`;
  });
});
