import { randomUUID } from "node:crypto";
import { addDaysStr } from "@koryo/billing";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const tag = randomUUID().slice(0, 6);
const certName = `Spec CPR ${tag}`;
const task = `Spec task ${tag}`;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const lastMonth = (() => { const [y, m] = today.split("-").map(Number) as [number, number]; return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7); })();
const started = new Date();
let instructor = "";

test.beforeAll(async () => {
  [{ id: instructor } = { id: "" }] = await sql<{ id: string }[]>`select id from auth.users where email = 'instructor@ridgelinetkd.demo'`;
});

test.afterAll(async () => {
  await sql`delete from staff_certifications where name = ${certName}`;
  await sql`delete from time_entries where user_id = ${instructor} and created_at >= ${started}`;
  await sql`delete from tasks where title = ${task}`;
  await sql`update kiosk_devices set revoked_at = now() where tenant_id = ${R} and name = ${`Spec staff kiosk ${tag}`}`;
});

test.describe("@m3 staff ops", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("expired cert shows in compliance; kiosk clock in/out; sessions taught last month; payroll CSV matches the view; tasks", async ({ browser }) => {
    test.setTimeout(120_000);
    const desk = await (await browser.newContext({ storageState: authState("ridgeline", "owner") })).newPage();
    await desk.goto("/desk/staff");
    await expectNoSeriousA11yViolations(desk);
    await desk.getByRole("list", { name: "Staff" }).getByRole("link", { name: "Sabumnim Grace Park" }).click();

    // An expired CPR certificate → compliance (staff page and dashboard).
    const cert = desk.getByRole("form", { name: "Add certification" });
    await cert.getByLabel("Kind").selectOption("cpr");
    await cert.getByLabel("Name (optional)").fill(certName);
    await cert.getByLabel("Issued").fill(addDaysStr(today, -400));
    await cert.getByLabel("Expires").fill(addDaysStr(today, -1));
    await cert.getByRole("button", { name: "Add certification" }).click();
    await expect(desk.getByRole("list", { name: "Certifications", exact: true }).getByRole("listitem", { name: certName })).toContainText("Expired");
    // Kiosk PIN.
    await desk.getByLabel("Kiosk PIN").fill("2468");
    await desk.getByRole("button", { name: "Set PIN" }).click();
    await expect(desk.getByText("PIN set.")).toBeVisible();
    await expectNoSeriousA11yViolations(desk);
    await desk.goto("/desk");
    await expect(desk.getByRole("list", { name: "Certifications needing attention" }).getByRole("listitem", { name: `Sabumnim Grace Park: ${certName}` })).toContainText(`Expired ${addDaysStr(today, -1)}`);

    // Kiosk: staff clock in, then out.
    const kiosk = await (await browser.newContext({ storageState: authState("ridgeline", "owner"), viewport: { width: 1024, height: 768 } })).newPage();
    await kiosk.goto("/kiosk");
    await kiosk.getByLabel("Device name").fill(`Spec staff kiosk ${tag}`);
    await kiosk.getByRole("button", { name: "Pair this device" }).click();
    const clock = async (expectText: string) => {
      await kiosk.getByRole("button", { name: "Staff clock" }).click();
      await kiosk.getByRole("button", { name: /Sabumnim Grace P\./ }).click();
      const pad = kiosk.getByRole("group", { name: "Staff PIN" });
      for (const d of "2468") await pad.getByRole("button", { name: d, exact: true }).click();
      await expect(kiosk.getByRole("status", { name: "Clocked" })).toContainText(expectText);
      await kiosk.getByRole("button", { name: "Start over" }).click();
    };
    await clock("Clocked in");
    await expectNoSeriousA11yViolations(kiosk);
    await clock("Clocked out");
    const [entry] = await sql`select source, clock_out is not null as closed from time_entries where user_id = ${instructor} and created_at >= ${started} order by created_at desc limit 1`;
    expect(entry).toEqual({ source: "kiosk", closed: true });

    // Payroll for last month: sessions taught = sessions in the schedule (substitutes teach instead).
    await desk.goto(`/desk/staff/payroll?period=${lastMonth}`);
    await expectNoSeriousA11yViolations(desk);
    const taught = await sql<{ user_id: string; n: number }[]>`
      select u.user_id, count(*)::int as n from class_sessions s
      cross join lateral unnest(case when cardinality(s.substitute_ids) > 0 then s.substitute_ids else s.instructor_ids end) as u(user_id)
      join tenants t on t.id = s.tenant_id
      where s.tenant_id = ${R} and s.status <> 'cancelled' and s.starts_at <= now() and to_char(s.starts_at at time zone t.timezone, 'YYYY-MM') = ${lastMonth}
      group by u.user_id`;
    const grace = taught.find((t) => t.user_id === instructor)?.n ?? 0;
    if (grace > 0) await expect(desk.getByRole("row", { name: "Sabumnim Grace Park" }).getByTestId("sessions")).toHaveText(String(grace));
    else await expect(desk.getByRole("row", { name: "Sabumnim Grace Park" })).toHaveCount(0);

    // CSV totals = the view's totals for the month.
    const csv = await desk.request.get(`/desk/staff/payroll/export?period=${lastMonth}`);
    expect(csv.status()).toBe(200);
    const lines = (await csv.text()).trim().split(/\r?\n/);
    expect(lines[0]).toBe("period,staff,hours,hourly_rate,hourly_pay,classes,per_class_rate,class_pay,commissions,total");
    const csvTotal = lines.slice(1).reduce((a, l) => a + Math.round(Number(l.split(",").at(-1)) * 100), 0);
    const csvClasses = lines.slice(1).reduce((a, l) => a + Number(l.split(",")[5]), 0);
    const [view] = await sql<{ total: number; classes: number }[]>`select coalesce(sum(total_cents), 0)::int as total, coalesce(sum(sessions), 0)::int as classes from v_payroll where tenant_id = ${R} and period = ${lastMonth}`;
    expect(csvTotal).toBe(view?.total);
    expect(csvClasses).toBe(view?.classes);
    expect(csvClasses).toBe(taught.reduce((a, t) => a + t.n, 0));

    // Tasks: add one for Grace; it shows under "All open"; mark it done.
    await desk.goto("/desk/tasks?view=all");
    await desk.getByLabel("Task", { exact: true }).fill(task);
    await desk.getByLabel("Assign to").selectOption({ label: "Sabumnim Grace Park" });
    await desk.getByRole("button", { name: "Add task" }).click();
    const item = desk.getByRole("list", { name: "Tasks" }).getByRole("listitem", { name: task });
    await expect(item).toBeVisible();
    await expectNoSeriousA11yViolations(desk);
    await item.getByRole("checkbox", { name: `Mark done: ${task}` }).check();
    await expect(item).toHaveCount(0);
    await desk.goto("/desk/tasks?view=done");
    await expect(desk.getByRole("list", { name: "Tasks" }).getByRole("listitem", { name: task })).toBeVisible();
  });
});
