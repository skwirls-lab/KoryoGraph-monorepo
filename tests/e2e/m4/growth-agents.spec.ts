import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { scoreLead } from "@koryo/ai";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expectNoSeriousA11yViolations } from "../support/axe";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const started = new Date();
const tag = randomUUID().slice(0, 6);
const last = `Lead${tag}`;
let insertedAttendance: string | null = null;

const runJob = async (request: APIRequestContext, name: string) => {
  const res = await request.post(`/api/jobs/${name}?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { stats: Record<string, number> };
};

test.afterAll(async () => {
  await sql`delete from home_updates where person_id = ${MAYA} and created_at >= ${started}`;
  await sql`delete from approval_items where tenant_id = ${R} and kind = 'parent_narrative' and created_at >= ${started}`;
  if (insertedAttendance) await sql`delete from attendance where id = ${insertedAttendance}`;
  const people = await sql<{ id: string }[]>`select id from people where last_name = ${last}`;
  await sql`delete from people where id = any(${people.map((p) => p.id)}::uuid[])`;
  await sql`update tenants set settings = settings #- '{ai,billing_recovery}' where id = ${R}`;
});

test.describe("@m4 growth agents", () => {
  test.use({ storageState: authState("ridgeline", "owner") });

  test("weekly narrative: drafted for a student who trained → edited and approved → shown to the family on Home", async ({ page, browser, request }) => {
    test.setTimeout(180_000);
    // Maya trained this week (a real check-in on a class that already happened).
    const [recent] = await sql<{ n: number }[]>`select count(*)::int as n from attendance where person_id = ${MAYA} and checked_in_at > now() - interval '6 days'`;
    if (!recent?.n) {
      const [s] = await sql<{ id: string }[]>`select id from class_sessions where tenant_id = ${R} and status <> 'cancelled' and starts_at between now() - interval '5 days' and now() - interval '1 hour' order by starts_at desc limit 1`;
      const [a] = await sql<{ id: string }[]>`insert into attendance (tenant_id, session_id, person_id, source, checked_in_at) values (${R}, ${s?.id ?? ""}, ${MAYA}, 'desk', now() - interval '1 day') returning id`;
      insertedAttendance = a?.id ?? null;
    }
    // Start from a clean week for Maya so the job drafts her update now.
    await sql`delete from approval_items where tenant_id = ${R} and kind = 'parent_narrative' and person_id = ${MAYA}`;
    await sql`delete from home_updates where person_id = ${MAYA}`;

    const first = await runJob(request, "parent_narratives");
    expect(first.stats.drafted).toBeGreaterThan(0);
    const [item] = await sql<{ id: string; title: string; body: string }[]>`
      select id, title, payload ->> 'body' as body from approval_items where tenant_id = ${R} and kind = 'parent_narrative' and person_id = ${MAYA} and status = 'pending'`;
    expect(item?.title).toBe("This week for Maya");
    expect(item?.body).toContain("Maya");
    expect(item?.body).not.toMatch(/\{\{/);
    // Nothing reaches Home before approval.
    expect((await sql`select 1 from home_updates where person_id = ${MAYA}`).length).toBe(0);

    // Re-running the same week doesn't draft Maya again.
    const again = await runJob(request, "parent_narratives");
    expect(again.stats.drafted).toBe(0);

    await page.goto("/desk/inbox/approvals?kind=parent_narrative");
    const card = page.getByRole("article", { name: "This week for Maya" });
    const text = card.getByRole("textbox", { name: /Shown to the family on Home/ });
    await expect(text).toHaveValue(item?.body ?? "");
    const edited = `${item?.body ?? ""} See you Saturday!`;
    await text.fill(edited);
    await expectNoSeriousA11yViolations(page);
    await card.getByRole("button", { name: "Approve and publish" }).click();
    await expect(page.getByText("Approved — Published on Home")).toBeVisible();

    const home = await (await browser.newContext({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } })).newPage();
    await home.goto("/home");
    const update = home.getByRole("region", { name: "This week for Maya Cooper" });
    await expect(update).toContainText("See you Saturday!");
    await expect(update).toContainText(item?.body.slice(0, 40) ?? "");
    await expectNoSeriousA11yViolations(home);
  });

  test("lead scoring: a new lead gets a transparent score and a suggested next step on the board", async ({ page, browser, request }) => {
    test.setTimeout(120_000);
    const anon = await (await browser.newContext()).newPage();
    await anon.goto("/s/ridgeline/trial");
    await anon.getByLabel("First name").fill("Sam");
    await anon.getByLabel("Last name").fill(last);
    await anon.getByLabel("Email").fill(`sam.${tag}@example.test`);
    await anon.getByLabel("Anything we should know?").fill("Looking for an evening class for my son.");
    await anon.getByRole("button", { name: "Request my trial" }).click();
    await expect(anon.getByRole("status")).toContainText("Thanks, Sam!");

    const r = await runJob(request, "lead_scoring");
    expect(r.stats.scored).toBeGreaterThan(0);
    const [lead] = await sql<{ score: number | null; ai_next_action: string | null; scored_at: string | null }[]>`
      select l.score, l.ai_next_action, l.scored_at from leads l join people p on p.id = l.person_id where p.last_name = ${last}`;
    // The score is the documented formula applied to the lead's real signals.
    expect(lead?.score).toBe(scoreLead({ stage: "new", source: "website", hasMessage: true, daysOld: 0, activities: 1, trialBooked: false, trialAttended: false, lastTouchDays: 0 }).score);
    expect(lead?.ai_next_action).toBe("Call today to welcome them and book a trial class");

    // Unchanged leads aren't rescored.
    const again = await runJob(request, "lead_scoring");
    const [after] = await sql<{ scored_at: string }[]>`select l.scored_at from leads l join people p on p.id = l.person_id where p.last_name = ${last}`;
    expect(after?.scored_at).toEqual(lead?.scored_at);
    expect(again.stats.scored).toBe(0);

    await page.goto("/desk/crm");
    const card = page.getByRole("list", { name: "New leads" }).getByRole("listitem", { name: `Sam ${last}` });
    await expect(card.getByLabel(`Score ${lead?.score}`)).toBeVisible();
    await expect(card).toContainText("Suggested: Call today to welcome them and book a trial class");
    await expectNoSeriousA11yViolations(page);
  });

  test("billing recovery mode is a per-school setting (off by default)", async ({ page }) => {
    await page.goto("/desk/settings/ai");
    const mode = page.getByLabel("Failed-payment follow-ups");
    await expect(mode).toHaveValue("off");
    await page.waitForLoadState("networkidle");
    await mode.selectOption("approve");
    await expect(page.getByText("Saved")).toBeVisible();
    const [t] = await sql<{ mode: string }[]>`select settings #>> '{ai,billing_recovery}' as mode from tenants where id = ${R}`;
    expect(t?.mode).toBe("approve");
    await page.reload();
    await expect(page.getByLabel("Failed-payment follow-ups")).toHaveValue("approve");
  });
});
