import { afterAll, describe, expect, it } from "vitest";
import { addMember, asClaims, createTenantWithOwner, mintSession, sql } from "./harness";

afterAll(async () => {
  await sql.end();
});

describe("multi-location scoping (RLS)", () => {
  it("staff limited to location A can't read or write location B; the owner's rollup sums both", async () => {
    const { tenantId, ownerEmail, ownerId } = await createTenantWithOwner("Two Site Dojo");
    const [a] = await sql<{ id: string }[]>`select id from locations where tenant_id = ${tenantId} and is_default`;
    const [b] = await sql<{ id: string }[]>`insert into locations (tenant_id, name, timezone) values (${tenantId}, 'Westside', 'America/New_York') returning id`;
    const A = a?.id ?? "";
    const B = b?.id ?? "";
    const today = (await sql<{ d: string }[]>`select (now() at time zone 'America/New_York')::date::text as d`)[0]?.d ?? "";
    const mk = async (loc: string, name: string) => (await sql<{ id: string }[]>`
      insert into class_sessions (tenant_id, location_id, name, occurrence_date, starts_at, ends_at, status)
      values (${tenantId}, ${loc}, ${name}, ${today}, now() - interval '1 hour', now(), 'scheduled') returning id`)[0]?.id ?? "";
    const sA = await mk(A, "Main kids");
    const sB = await mk(B, "Westside kids");
    const [p] = await sql<{ id: string }[]>`insert into people (tenant_id, type_flags, first_name, last_name, status, primary_location_id) values (${tenantId}, '{student}', 'Wes', 'Side', 'active', ${B}) returning id`;
    await sql`insert into attendance (tenant_id, session_id, person_id, source) values (${tenantId}, ${sB}, ${p?.id ?? ""}, 'desk'), (${tenantId}, ${sA}, ${p?.id ?? ""}, 'desk')`;

    const staffEmail = await addMember(tenantId, "instructor");
    const [staffUser] = await sql<{ id: string }[]>`select id from profiles where email = ${staffEmail}`;
    const owner = (await mintSession(ownerEmail)).claims;
    await asClaims(owner, (tx) => tx`select public.set_staff_locations(${staffUser?.id ?? ""}, ${[A]}::uuid[])`);
    await expect(asClaims(owner, (tx) => tx`select public.set_staff_locations(${ownerId}, ${[A]}::uuid[])`)).rejects.toThrow(/owners always/);
    await expect(asClaims(owner, (tx) => tx`select public.set_staff_locations(${staffUser?.id ?? ""}, ${["00000000-0000-4000-8000-000000000000"]}::uuid[])`)).rejects.toThrow(/unknown location/);

    const staff = (await mintSession(staffEmail)).claims;
    const sessions = await asClaims(staff, (tx) => tx<{ name: string }[]>`select name from class_sessions order by name`);
    expect(sessions.map((s) => s.name)).toEqual(["Main kids"]);
    const att = await asClaims(staff, (tx) => tx<{ session_id: string }[]>`select session_id from attendance`);
    expect(att.map((x) => x.session_id)).toEqual([sA]);
    await expect(asClaims(staff, (tx) => tx`insert into class_templates (tenant_id, location_id, name, rrule, start_date, start_time) values (${tenantId}, ${B}, 'Sneaky', 'FREQ=WEEKLY;BYDAY=MO', ${today}, '17:00')`)).rejects.toMatchObject({ code: "42501" });
    expect(await asClaims(staff, (tx) => tx`update class_sessions set name = 'renamed' where id = ${sB} returning id`)).toHaveLength(0);

    const all = await asClaims(owner, (tx) => tx<{ location_name: string; classes_today: number; attendance_this_week: number; active_students: number }[]>`select * from public.location_rollup()`);
    expect(all.map((r) => r.location_name).sort()).toEqual(["Main location", "Westside"]);
    expect(all.reduce((n, r) => n + r.classes_today, 0)).toBe(2);
    expect(all.reduce((n, r) => n + r.attendance_this_week, 0)).toBe(2);
    expect(all.find((r) => r.location_name === "Westside")?.active_students).toBe(1);
    const mine = await asClaims(staff, (tx) => tx<{ location_name: string }[]>`select location_name from public.location_rollup()`);
    expect(mine.map((r) => r.location_name)).toEqual(["Main location"]);
  });
});
