import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const RILEY = sid("person:ridgeline:riley-adams");
const name = `DB after-school ${randomUUID().slice(0, 6)}`;
let program = "";
let plan = "";
const enrollments: Record<string, string> = {};

beforeAll(async () => {
  const owner = await seededClaims("owner@ridgelinetkd.demo");
  const [p] = await asClaims(owner, (tx) => tx<{ id: string }[]>`select public.save_afterschool_program(${sql.json({ name, weekly_price_cents: 9500, schools: ["Oak Elementary", "Pine Middle"], routes: ["North", "South"], days_of_week: [1, 2, 3, 4, 5], pickup_cutoff: "15:45" })}) as id`);
  program = p?.id ?? "";
  const [pr] = await sql<{ plan_id: string }[]>`select plan_id from afterschool_programs where id = ${program}`;
  plan = pr?.plan_id ?? "";
});

afterAll(async () => {
  await sql`delete from communications where related_type = 'afterschool_attendance' and related_id in (select a.id from afterschool_attendance a join afterschool_enrollments e on e.id = a.enrollment_id where e.program_id = ${program})`;
  await sql`delete from invoices where id in (select invoice_id from invoice_lines where ref_id in (select id from memberships where plan_id = ${plan}))`;
  await sql`delete from afterschool_programs where id = ${program}`;
  await sql`delete from memberships where plan_id = ${plan}`;
  await sql`delete from membership_plans where id = ${plan}`;
  await sql.end();
});

describe("after-school", () => {
  it("a program gets a weekly recurring plan; enrolling creates a weekly membership", async () => {
    const [pl] = await sql`select kind, interval, price_cents from membership_plans where id = ${plan}`;
    expect(pl).toEqual({ kind: "recurring", interval: "week", price_cents: 9500 });
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const enroll = (person: string, school: string, route: string, days: number[]) =>
      asClaims(owner, (tx) => tx<{ id: string }[]>`select public.afterschool_enroll(${program}, ${person}, ${school}, ${route}, ${days}, current_date) as id`);
    await expect(enroll(MAYA, "Elsewhere", "North", [1])).rejects.toThrow(/schools/);
    await expect(enroll(MAYA, "Oak Elementary", "North", [6])).rejects.toThrow(/days the program runs/);
    const [m] = await enroll(MAYA, "Oak Elementary", "North", [1, 2, 3, 4, 5]);
    const [r] = await enroll(RILEY, "Pine Middle", "South", [2, 4]);
    enrollments.maya = m?.id ?? "";
    enrollments.riley = r?.id ?? "";
    await expect(enroll(MAYA, "Oak Elementary", "North", [1])).rejects.toThrow(/already enrolled/);
    const [ms] = await sql`select m.status, m.next_bill_at = current_date as due_today, p.interval from memberships m join membership_plans p on p.id = m.plan_id
                           join afterschool_enrollments e on e.membership_id = m.id where e.id = ${enrollments.maya ?? ""}`;
    expect(ms).toEqual({ status: "active", due_today: true, interval: "week" });
  });

  it("parents can't mark attendance; marking absent queues one alert to guardians", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.afterschool_mark(${enrollments.maya ?? ""}, current_date, 'absent')`)).rejects.toMatchObject({ code: "42501" });
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    await asClaims(owner, (tx) => tx`select public.afterschool_mark(${enrollments.maya ?? ""}, current_date, 'absent', null, null, 'not at the school door')`);
    await asClaims(owner, (tx) => tx`select public.afterschool_mark(${enrollments.maya ?? ""}, current_date, 'absent')`);
    const msgs = await sql`select c.template_key, c.status, c.data->>'student_name' as student, c.data->>'school' as school from communications c
                           join afterschool_attendance a on a.id = c.related_id where a.enrollment_id = ${enrollments.maya ?? ""}`;
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs.every((m) => m.template_key === "afterschool_absent" && m.status === "queued" && m.student === "Maya" && m.school === "Oak Elementary")).toBe(true);
    const channels = new Set(msgs.map((m) => `${m.template_key}`));
    expect(channels.size).toBe(1);
    const again = await sql`select count(*)::int as n from communications c join afterschool_attendance a on a.id = c.related_id where a.enrollment_id = ${enrollments.maya ?? ""}`;
    expect(again[0]?.n).toBe(msgs.length); // the second 'absent' didn't alert again
  });

  it("release needs a name and signature after arrival", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const mark = (action: string, to: string | null, sig: string | null) =>
      asClaims(owner, (tx) => tx`select public.afterschool_mark(${enrollments.riley ?? ""}, current_date, ${action}, ${to}, ${sig})`);
    await expect(mark("released", "Sam Adams", `${R}/events/afterschool/x.png`)).rejects.toThrow(/arrived first/);
    await mark("arrived", null, null);
    await expect(mark("released", "Sam Adams", null)).rejects.toThrow(/signature/);
    await mark("released", "Sam Adams", `${R}/events/afterschool/x.png`);
    const [a] = await sql`select released_to, picked_up_at is not null as picked, absent from afterschool_attendance where enrollment_id = ${enrollments.riley ?? ""} and date = current_date`;
    expect(a).toEqual({ released_to: "Sam Adams", picked: true, absent: false });
  });

  it("the cutoff job marks expected children with no pickup absent and alerts once", async () => {
    // A Tuesday at 16:30 school time, a week out: both children are expected (Riley comes Tue/Thu).
    const [t] = await sql<{ tue: string }[]>`select (current_date + ((9 - extract(isodow from current_date)::int) % 7) + 7)::text as tue`;
    const at = `${t?.tue} 16:30 America/New_York`;
    const [n] = await sql<{ n: number }[]>`select public.afterschool_cutoff(${R}, ${at}::text::timestamptz) as n`;
    const mine = await sql`select e.person_id, a.absent, a.absence_reason from afterschool_attendance a join afterschool_enrollments e on e.id = a.enrollment_id where e.program_id = ${program} and a.date = ${t?.tue ?? ""}::date order by e.person_id`;
    expect(mine).toHaveLength(2);
    expect(mine.every((m) => m.absent && m.absence_reason === "not at pickup by the cutoff")).toBe(true);
    expect(n?.n).toBeGreaterThanOrEqual(2);
    await sql`select public.afterschool_cutoff(${R}, ${at}::text::timestamptz)`;
    const alerts = await sql`select count(*)::int as n from communications c join afterschool_attendance a on a.id = c.related_id join afterschool_enrollments e on e.id = a.enrollment_id
                             where e.program_id = ${program} and a.date = ${t?.tue ?? ""}::date`;
    const first = alerts[0]?.n ?? 0;
    expect(first).toBeGreaterThan(0);
    await sql`select public.afterschool_cutoff(${R}, ${at}::text::timestamptz)`;
    const again = await sql`select count(*)::int as n from communications c join afterschool_attendance a on a.id = c.related_id join afterschool_enrollments e on e.id = a.enrollment_id
                            where e.program_id = ${program} and a.date = ${t?.tue ?? ""}::date`;
    expect(again[0]?.n).toBe(first); // once per child per day
    // Before the cutoff (the Thursday after, 15:00) nothing is marked.
    await sql`select public.afterschool_cutoff(${R}, ${`${t?.tue} 15:00 America/New_York`}::text::timestamptz + interval '2 days')`;
    const [thu] = await sql`select count(*)::int as n from afterschool_attendance a join afterschool_enrollments e on e.id = a.enrollment_id where e.program_id = ${program} and a.date = ${t?.tue ?? ""}::date + 2`;
    expect(thu?.n).toBe(0);
  });
});
