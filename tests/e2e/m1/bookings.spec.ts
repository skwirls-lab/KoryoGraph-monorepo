import { randomUUID } from "node:crypto";
import { sid } from "../../../scripts/lib/ids";
import { sql } from "../../db/harness";
import { authState } from "../support/auth";
import { expect, test } from "../support/fixtures";

const R = sid("tenant:ridgeline");
const LOC = sid("location:ridgeline:main");
const P = (k: string) => sid(`person:ridgeline:${k}`);
const tag = randomUUID().slice(0, 6);
const className = `Booking Class ${tag}`;
let programId = "";
let sessionId = "";

test.beforeAll(async () => {
  const [p] = await sql<{ id: string }[]>`insert into public.programs (tenant_id, name, slug) values (${R}, ${`Booking Program ${tag}`}, ${`booking-${tag}`}) returning id`;
  programId = p?.id ?? "";
  for (const k of ["maya-cooper", "leo-cooper", "riley-adams"]) {
    await sql`insert into public.enrollments (tenant_id, person_id, program_id) values (${R}, ${P(k)}, ${programId})`;
  }
  const start = new Date(Date.now() + 2 * 86400_000);
  const [s] = await sql<{ id: string }[]>`
    insert into public.class_sessions (tenant_id, location_id, name, program_ids, occurrence_date, starts_at, ends_at, capacity, bookable, cancellation_window_min)
    values (${R}, ${LOC}, ${className}, ${[programId]}, (${start}::timestamptz at time zone 'America/New_York')::date, ${start}, ${new Date(start.getTime() + 3600_000)}, 2, true, 120)
    returning id`;
  sessionId = s?.id ?? "";
});

test.afterAll(async () => {
  await sql`delete from public.communications where related_id = ${sessionId}`;
  await sql`delete from public.class_sessions where id = ${sessionId}`;
  await sql`delete from public.programs where id = ${programId}`;
});

test.describe("@m1 bookings", () => {
  test("capacity 2: third is waitlisted; a timely cancel promotes them and earns a makeup credit", async ({ browser }) => {
    const parentCtx = await browser.newContext({ storageState: authState("ridgeline", "parent"), viewport: { width: 390, height: 844 } });
    const parent = await parentCtx.newPage();
    await parent.goto("/home/schedule");
    for (const name of ["Maya Cooper", "Leo Cooper"]) {
      await parent.getByRole("region", { name: `${name} schedule` }).getByRole("button", { name: new RegExp(`^Book ${name} into ${className}`) }).click();
      await expect(parent.getByRole("region", { name: `${name} schedule` }).getByRole("listitem", { name: new RegExp(className) })).toContainText("Booked");
    }

    const studentCtx = await browser.newContext({ storageState: authState("ridgeline", "student"), viewport: { width: 390, height: 844 } });
    const student = await studentCtx.newPage();
    await student.goto("/home/schedule");
    const riley = student.getByRole("region", { name: "Riley Adams schedule" });
    await riley.getByRole("button", { name: new RegExp(`^Join waitlist Riley Adams into ${className}`) }).click();
    await expect(student.getByText("On the waitlist (#1)")).toBeVisible();
    await expect(riley.getByRole("listitem", { name: new RegExp(className) })).toContainText("Waitlist #1");

    await parent.getByRole("button", { name: new RegExp(`^Cancel Maya Cooper into ${className}`) }).click();
    await expect(parent.getByText("Cancelled — a makeup credit was added")).toBeVisible();
    await expect(parent.getByRole("region", { name: "Maya Cooper schedule" })).toContainText("1 makeup credit");

    const rows = await sql<{ person_id: string; status: string }[]>`select person_id, status from public.bookings where session_id = ${sessionId} order by person_id`;
    expect(Object.fromEntries(rows.map((r) => [r.person_id, r.status]))).toEqual({
      [P("maya-cooper")]: "cancelled", [P("leo-cooper")]: "booked", [P("riley-adams")]: "booked",
    });
    const [credit] = await sql<{ n: number }[]>`select count(*)::int as n from public.makeup_credits where person_id = ${P("maya-cooper")} and earned_from_session_id = ${sessionId}`;
    expect(credit?.n).toBe(1);

    // The promotion notice for Riley's family is queued, then dispatched by the outbox job.
    const queued = await sql<{ channel: string; status: string }[]>`select channel, status from public.communications where related_id = ${sessionId} and template_key = 'waitlist_promoted'`;
    expect(queued.map((q) => q.status)).toEqual(expect.arrayContaining(["queued"]));
    const res = await parent.request.post(`/api/jobs/outbox_dispatch?tenant=${R}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(res.status()).toBe(200);
    const after = await sql<{ channel: string; status: string; body_text: string }[]>`select channel, status, body_text from public.communications where related_id = ${sessionId} and template_key = 'waitlist_promoted' order by channel`;
    expect(after.find((a) => a.channel === "email")).toMatchObject({ status: "unsent_no_provider" });
    expect(after.find((a) => a.channel === "inapp")).toMatchObject({ status: "sent" });
    expect(after.find((a) => a.channel === "email")?.body_text).toContain(`Riley is now booked into ${className}`);

    await student.reload();
    await expect(riley.getByRole("listitem", { name: new RegExp(className) })).toContainText("Booked");
    await parentCtx.close();
    await studentCtx.close();
  });
});
