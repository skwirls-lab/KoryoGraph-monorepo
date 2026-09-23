import path from "node:path";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { AB } from "../../fixtures/action-board";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const KID = sid("person:ridgeline:ab-kid");

async function cleanup() {
  await sql`delete from approval_items where kind = 'action_board' and entity_id = ${AB.session}`;
  await sql`delete from tasks where related_id = ${AB.session}`;
  await sql`delete from notes where person_id = any(${AB.students.map((s) => s.id)}::uuid[])`;
  await sql`delete from class_sessions where id = ${AB.session}`;
  await sql`delete from people where id = any(${[...AB.students.map((s) => s.id), KID]}::uuid[])`;
  await sql`delete from skills where id = any(${Object.values(AB.skills)}::uuid[])`;
  await sql`delete from programs where id = ${AB.program}`;
}

test.beforeAll(async () => {
  await cleanup();
  await sql`insert into programs (id, tenant_id, name, slug) values (${AB.program}, ${R}, 'Board Test Program', 'board-test')`;
  await sql`insert into ranks (id, tenant_id, program_id, name, belt_color, position) values (${AB.rank1}, ${R}, ${AB.program}, 'White', '#ffffff', 1), (${AB.rank2}, ${R}, ${AB.program}, 'Yellow', '#facc15', 2)`;
  for (const [name, id] of [["Low block", AB.skills.lowBlock], ["Front kick", AB.skills.frontKick], ["Taegeuk 1", AB.skills.taegeuk1]] as const) {
    await sql`insert into skills (id, tenant_id, program_id, name, category) values (${id}, ${R}, ${AB.program}, ${name}, 'other')`;
    await sql`insert into rank_skills (tenant_id, rank_id, skill_id, required) values (${R}, ${AB.rank2}, ${id}, true)`;
  }
  for (const s of AB.students) {
    await sql`insert into people (id, tenant_id, first_name, last_name, dob, type_flags, status) values (${s.id}, ${R}, ${s.first}, ${s.last}, '1990-05-05', '{student}', 'active')`;
    await sql`insert into enrollments (id, tenant_id, person_id, program_id, current_rank_id) values (${s.enrollment}, ${R}, ${s.id}, ${AB.program}, ${AB.rank1})`;
  }
  await sql`insert into class_sessions (id, tenant_id, location_id, name, program_ids, occurrence_date, starts_at, ends_at, status)
    values (${AB.session}, ${R}, ${sid("location:ridgeline:main")}, 'Board Test Class', ${[AB.program]}, current_date, now() - interval '2 hours', now() - interval '1 hour', 'scheduled')`;
});

test.afterAll(cleanup);

test.describe("@m4 action board", () => {
  test.use({ storageState: authState("ridgeline", "instructor"), viewport: { width: 1024, height: 900 } });

  test("upload the class audio → transcribed → board → approve all: 9 check-ins, 3 sign-offs, 1 task; the unsure row needs a tick", async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.goto(`/mat/session/${AB.session}`);
    const panel = page.getByRole("region", { name: "After class: action board" });
    await expect(panel).toBeVisible();
    await panel.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "tests/fixtures/audio/class-short.wav"));
    await expect(panel.getByRole("list", { name: "Recordings" })).toContainText("Waiting to transcribe");
    const run = await request.post(`/api/jobs/transcribe?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(run.ok(), await run.text()).toBe(true);
    await page.reload();
    await panel.getByRole("link", { name: "Open board" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Action board" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    const att = page.getByRole("list", { name: "Attendance confirmations" });
    await expect(att.getByRole("checkbox")).toHaveCount(10);
    await expect(att.getByRole("checkbox", { name: "Jo Boardtest was here" })).not.toBeChecked();
    await expect(att.getByRole("checkbox", { name: "Ari Boardtest was here" })).toBeChecked();
    await page.getByRole("button", { name: /^Approve all/ }).click();
    await expect(page.getByRole("status")).toContainText("9 check-ins, 3 sign-offs");

    const [a] = await sql<{ n: number }[]>`select count(*)::int as n from attendance where session_id = ${AB.session} and source = 'action_board'`;
    expect(a?.n).toBe(9);
    const [s] = await sql<{ n: number }[]>`select count(*)::int as n from skill_signoffs where enrollment_id = any(${AB.students.map((x) => x.enrollment)}::uuid[]) and source = 'action_board'`;
    expect(s?.n).toBe(3);
    const [t] = await sql<{ n: number }[]>`select count(*)::int as n from tasks where related_id = ${AB.session}`;
    expect(t?.n).toBe(1);
    const [inj] = await sql<{ n: number }[]>`select count(*)::int as n from notes where person_id = ${AB.students[3]?.id ?? ""} and kind = 'injury' and source = 'action_board'`;
    expect(inj?.n).toBe(1);
    const [jo] = await sql<{ n: number }[]>`select count(*)::int as n from attendance where session_id = ${AB.session} and person_id = ${AB.students[9]?.id ?? ""}`;
    expect(jo?.n).toBe(0);
  });

  test("a minor on the roster without AI-processing consent turns recording off (manual mode stays)", async ({ page }) => {
    await sql`insert into people (id, tenant_id, first_name, last_name, dob, type_flags, status) values (${KID}, ${R}, 'Kid', 'Boardtest', current_date - interval '9 years', '{student}', 'active') on conflict (id) do nothing`;
    await sql`insert into enrollments (tenant_id, person_id, program_id, current_rank_id) values (${R}, ${KID}, ${AB.program}, ${AB.rank1})`;
    await page.goto(`/mat/session/${AB.session}`);
    const panel = page.getByRole("region", { name: "After class: action board" });
    await expect(panel).toContainText("no AI-processing consent for Kid Boardtest");
    await expect(panel.getByRole("button", { name: "Record", exact: true })).toBeDisabled();
    await expect(panel.getByLabel("What happened in class?")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
