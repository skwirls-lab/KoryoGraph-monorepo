import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const LOC = sid("location:ridgeline:main");
const P = (k: string) => sid(`person:ridgeline:${k}`);
const COOPER = sid("household:ridgeline:cooper");
const ADAMS = sid("household:ridgeline:adams");
const tag = randomUUID().slice(0, 6);
const className = `Kiosk Class ${tag}`;
let programId = "";
let sessionId = "";

test.beforeAll(async () => {
  const [p] = await sql<{ id: string }[]>`insert into public.programs (tenant_id, name, slug) values (${R}, ${`Kiosk Program ${tag}`}, ${`kiosk-${tag}`}) returning id`;
  programId = p?.id ?? "";
  for (const k of ["maya-cooper", "leo-cooper", "riley-adams"]) {
    await sql`insert into public.enrollments (tenant_id, person_id, program_id) values (${R}, ${P(k)}, ${programId})`;
  }
  const start = new Date(Date.now() + 10 * 60_000);
  const [s] = await sql<{ id: string }[]>`
    insert into public.class_sessions (tenant_id, location_id, name, program_ids, occurrence_date, starts_at, ends_at)
    values (${R}, ${LOC}, ${className}, ${[programId]}, (${start}::timestamptz at time zone 'America/New_York')::date, ${start}, ${new Date(start.getTime() + 3600_000)})
    returning id`;
  sessionId = s?.id ?? "";
  for (const [hid, pin] of [[COOPER, "4321"], [ADAMS, "1111"]] as const) {
    await sql`insert into public.kiosk_pins (tenant_id, household_id, pin_hash) values (${R}, ${hid}, extensions.crypt(${pin}, extensions.gen_salt('bf', 8)))
      on conflict (household_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null`;
  }
});

test.afterAll(async () => {
  await sql`delete from public.class_sessions where id = ${sessionId}`;
  await sql`delete from public.programs where id = ${programId}`;
  await sql`update public.kiosk_pins set failed_attempts = 0, locked_until = null where household_id in (${COOPER}, ${ADAMS})`;
  await sql`update public.kiosk_devices set revoked_at = now() where tenant_id = ${R} and name like 'Spec kiosk%' and revoked_at is null`;
});

async function pair(page: Page) {
  await page.goto("/kiosk");
  await page.getByLabel("Device name").fill(`Spec kiosk ${tag}`);
  await page.getByRole("button", { name: "Pair this device" }).click();
  await expect(page.getByRole("heading", { name: "Welcome! Type your first or last name." })).toBeVisible();
}

async function pressPin(page: Page, pin: string) {
  const pad = page.getByRole("group", { name: "Family PIN" });
  for (const d of pin) await pad.getByRole("button", { name: d, exact: true }).click();
}

test.describe("@m1 kiosk", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("pair, search 'ma', PIN, check in → appears on the Mat roster", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authState("ridgeline", "owner"), viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await pair(page);

    // Pairing signed the staff member out on this device.
    const res = await page.request.get("/desk", { maxRedirects: 0 });
    expect(res.status()).toBe(307);

    await page.getByRole("textbox", { name: "Name", exact: true }).fill("ma");
    await page.getByRole("list", { name: "Matching students" }).getByRole("button", { name: /Maya Cooper/ }).click();
    await expect(page.getByRole("button", { name: "Maya Cooper" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Leo Cooper" })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Continue" }).click();
    await pressPin(page, "4321");
    const pick = page.getByRole("group", { name: "Maya Cooper" }).getByRole("button", { name: new RegExp(className) });
    await expect(pick).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Check in" }).click();
    await expect(page.getByRole("status", { name: "Checked in" })).toContainText("Maya Cooper");

    const [row] = await sql<{ source: string }[]>`select source from public.attendance where session_id = ${sessionId} and person_id = ${P("maya-cooper")}`;
    expect(row?.source).toBe("kiosk");

    const instructor = await browser.newContext({ storageState: authState("ridgeline", "instructor") });
    const mat = await instructor.newPage();
    await mat.goto(`/mat/session/${sessionId}`);
    await expect(mat.getByRole("list", { name: "Roster" }).getByRole("button", { name: "Maya Cooper, present" })).toBeVisible();
    await instructor.close();
    await ctx.close();
  });

  test("five wrong PINs lock the family out", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authState("ridgeline", "admin"), viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await pair(page);
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("riley");
    await page.getByRole("list", { name: "Matching students" }).getByRole("button", { name: /Riley Adams/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    for (let i = 1; i <= 4; i++) {
      await pressPin(page, "0000");
      await expect(page.getByRole("alert").filter({ hasText: /tries|try|attempts/ })).toContainText(`${5 - i} ${5 - i === 1 ? "try" : "tries"} left`);
    }
    await pressPin(page, "0000");
    await expect(page.getByRole("alert").filter({ hasText: /tries|try|attempts/ })).toContainText("Too many attempts");
    // Even the right PIN is refused while locked.
    await pressPin(page, "1111");
    await expect(page.getByRole("alert").filter({ hasText: /tries|try|attempts/ })).toContainText("Too many attempts");
    await ctx.close();
  });
});
