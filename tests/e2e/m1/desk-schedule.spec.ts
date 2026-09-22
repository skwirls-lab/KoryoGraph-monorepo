import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const tag = randomUUID().slice(0, 6);
const programName = `Sched Spec ${tag}`;
const className = `Spec Class ${tag}`;
let programId = "";

test.beforeAll(async () => {
  const [p] = await sql<{ id: string }[]>`insert into public.programs (tenant_id, name, slug) values (${R}, ${programName}, ${`sched-spec-${tag}`}) returning id`;
  programId = p?.id ?? "";
  const [r] = await sql<{ id: string }[]>`insert into public.ranks (tenant_id, program_id, name, position) values (${R}, ${programId}, 'White', 1) returning id`;
  await sql`insert into public.enrollments (tenant_id, person_id, program_id, current_rank_id) values (${R}, ${MAYA}, ${programId}, ${r?.id ?? ""})`;
});

test.afterAll(async () => {
  await sql`delete from public.class_templates where name = ${className}`;
  await sql`delete from public.class_sessions where name = ${className}`;
  await sql`delete from public.programs where id = ${programId}`;
});

test.describe("@m1 desk schedule", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("create a class → sessions in the week view → cancel one → roster families get a queued message", async ({ page }) => {
    await page.goto("/desk/schedule");
    await page.getByRole("button", { name: "New class" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Class name", { exact: true }).fill(className);
    for (const day of ["Mon", "Wed"]) await d.getByRole("button", { name: day, exact: true }).click(); // clear defaults
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) await d.getByRole("button", { name: day, exact: true }).click();
    await d.getByLabel("Start time", { exact: true }).fill("23:30");
    await d.getByLabel(programName).check();
    await d.getByLabel("Capacity", { exact: true }).fill("12");
    await d.getByRole("button", { name: "Add class" }).click();
    await expect(d).toBeHidden();

    const sessionLinks = page.getByRole("link", { name: new RegExp(`^${className} `) });
    await expect(sessionLinks.first()).toBeVisible();
    expect(await sessionLinks.count()).toBeGreaterThanOrEqual(1);

    await sessionLinks.last().click();
    await expect(page.getByRole("heading", { level: 1, name: className })).toBeVisible();
    await expect(page.getByRole("table", { name: `Roster for ${className}` })).toContainText("Maya Cooper");

    await page.getByRole("button", { name: "Cancel class" }).click();
    const cd = page.getByRole("dialog");
    await cd.getByLabel("Reason (shared with families)").fill("Instructor at tournament");
    await cd.getByRole("button", { name: "Cancel class" }).click();
    await expect(page.getByRole("status").filter({ hasText: "This session is cancelled — Instructor at tournament" })).toBeVisible();

    const msgs = page.getByRole("list", { name: "Messages about this session" });
    await expect(msgs).toContainText("email → parent@ridgelinetkd.demo");
    await expect(msgs).toContainText("unsent no provider");

    const sessionId = page.url().split("/").pop() ?? "";
    const rows = await sql<{ status: string; template_key: string; body_text: string }[]>`
      select status, template_key, body_text from public.communications where related_type = 'class_session' and related_id = ${sessionId}`;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.template_key === "class_cancelled")).toBe(true);
    expect(rows.find((r) => r.status === "unsent_no_provider")?.body_text).toContain("Instructor at tournament");

    // The week view shows it cancelled; a re-run of the job keeps it cancelled.
    await page.goto("/desk/schedule");
    await expect(page.getByRole("link", { name: new RegExp(`^${className} .* cancelled$`) }).first()).toBeVisible();
  });

  test("the jobs endpoint rejects requests without the cron secret", async ({ request }) => {
    const res = await request.post("/api/jobs/materialize_sessions");
    expect(res.status()).toBe(401);
    const ok = await request.post(`/api/jobs/materialize_sessions?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()) as { status: string }).toMatchObject({ status: "ok" });
  });
});
