import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const LOC = sid("location:ridgeline:main");
const P = (k: string) => sid(`person:ridgeline:${k}`);
const tag = randomUUID().slice(0, 6);
const className = `Mat Spec ${tag}`;
let programId = "";
let sessionId = "";

test.beforeAll(async () => {
  const [p] = await sql<{ id: string }[]>`insert into public.programs (tenant_id, name, slug) values (${R}, ${`Mat Program ${tag}`}, ${`mat-spec-${tag}`}) returning id`;
  programId = p?.id ?? "";
  const [white] = await sql<{ id: string }[]>`insert into public.ranks (tenant_id, program_id, name, position, stripes_max) values (${R}, ${programId}, 'White', 1, 4) returning id`;
  await sql`insert into public.ranks (tenant_id, program_id, name, position) values (${R}, ${programId}, 'Yellow', 2)`;
  for (const k of ["maya-cooper", "leo-cooper", "riley-adams"]) {
    await sql`insert into public.enrollments (tenant_id, person_id, program_id, current_rank_id) values (${R}, ${P(k)}, ${programId}, ${white?.id ?? ""})`;
  }
  const start = new Date(Date.now() - 5 * 60_000);
  const [s] = await sql<{ id: string }[]>`
    insert into public.class_sessions (tenant_id, location_id, name, program_ids, occurrence_date, starts_at, ends_at, capacity)
    values (${R}, ${LOC}, ${className}, ${[programId]}, (${start}::timestamptz at time zone 'America/New_York')::date, ${start}, ${new Date(start.getTime() + 3600_000)}, 20)
    returning id`;
  sessionId = s?.id ?? "";
});

test.afterAll(async () => {
  await sql`delete from public.class_sessions where id = ${sessionId}`;
  await sql`delete from public.programs where id = ${programId}`;
});

test.describe("@m1 mat attendance", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("check in on the Mat, award a stripe that shows on Home, and sync offline check-ins", async ({ browser }) => {
    const instructor = await browser.newContext({ storageState: authState("ridgeline", "instructor"), viewport: { width: 390, height: 844 } });
    const page = await instructor.newPage();
    await page.goto("/mat");
    await page.getByRole("link", { name: new RegExp(className) }).click();
    const roster = page.getByRole("list", { name: "Roster" });
    await expect(roster.getByRole("listitem")).toHaveCount(3);

    for (const name of ["Maya Cooper", "Leo Cooper", "Riley Adams"]) {
      await roster.getByRole("button", { name: new RegExp(`^${name}, not checked in`) }).click();
      await expect(roster.getByRole("button", { name: `${name}, present` })).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.getByText("3 of 3 checked in")).toBeVisible();
    await page.waitForTimeout(500);
    await page.reload();
    for (const name of ["Maya Cooper", "Leo Cooper", "Riley Adams"]) {
      await expect(roster.getByRole("button", { name: `${name}, present` })).toHaveAttribute("aria-pressed", "true");
    }

    // One-tap stripe from the quick card.
    await roster.getByRole("button", { name: "Details for Maya Cooper" }).click();
    await page.getByRole("button", { name: "Award stripe" }).click();
    await expect(page.getByText("Stripe awarded (1)")).toBeVisible();
    await page.keyboard.press("Escape");

    // The parent sees it on Home.
    const parent = await browser.newContext({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } });
    const home = await parent.newPage();
    await home.goto("/home/progress");
    const maya = home.getByRole("region", { name: "Maya Cooper" });
    await expect(maya.getByLabel("White, 1 stripe")).toBeVisible();
    await parent.close();

    // Offline: uncheck Leo, see it queued, reconnect, and it syncs.
    await instructor.setOffline(true);
    await roster.getByRole("button", { name: "Leo Cooper, present" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Offline — 1 check-in waiting to sync" })).toBeVisible();
    await instructor.setOffline(false);
    await expect(page.getByText("Synced 1 check-in")).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(roster.getByRole("button", { name: /^Leo Cooper, not checked in/ })).toHaveAttribute("aria-pressed", "false");
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from public.attendance where session_id = ${sessionId}`;
    expect(row?.n).toBe(2);
    await instructor.close();
  });
});
