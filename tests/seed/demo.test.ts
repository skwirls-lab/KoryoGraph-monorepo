import { afterAll, describe, expect, it } from "vitest";
import { createSeedContext } from "../../scripts/seed/context";
import { seedDemo } from "../../scripts/seed/demo";
import { sid } from "../../scripts/lib/ids";
import { sql } from "../db/harness";

// Runs after `db:seed --profile demo` (gate step "seed invariants"). Fails if the demo data is absent.
const R = sid("tenant:ridgeline");

afterAll(async () => {
  await sql.end();
});

const counts = async () => {
  const rows = await sql<{ t: string; n: number }[]>`
    select 'people' t, count(*)::int n from people where tenant_id = ${R}
    union all select 'households', count(*)::int from households where tenant_id = ${R}
    union all select 'class_sessions', count(*)::int from class_sessions where tenant_id = ${R}
    union all select 'attendance', count(*)::int from attendance where tenant_id = ${R}
    union all select 'enrollments', count(*)::int from enrollments where tenant_id = ${R}
    union all select 'promotions', count(*)::int from promotions where tenant_id = ${R}
    union all select 'signatures', count(*)::int from signatures where tenant_id = ${R}`;
  return Object.fromEntries(rows.map((r) => [r.t, r.n]));
};

describe("demo seed invariants", () => {
  it("has a realistic school", async () => {
    const c = await counts();
    expect(c.people).toBeGreaterThan(350);
    expect(c.households).toBeGreaterThan(100);
    expect(c.attendance).toBeGreaterThan(15_000);
    expect(c.promotions).toBeGreaterThan(200);
  });

  it("every student belongs to at least one household", async () => {
    const rows = await sql`select p.id from people p where p.tenant_id = ${R} and 'student' = any (p.type_flags)
      and not exists (select 1 from household_members hm where hm.person_id = p.id)`;
    expect(rows).toHaveLength(0);
  });

  it("attendance is only for people enrolled in (or booked into) that session's program, and never in the future", async () => {
    const orphan = await sql`select a.id from attendance a join class_sessions s on s.id = a.session_id where a.tenant_id = ${R}
      and not exists (select 1 from enrollments e where e.person_id = a.person_id and e.program_id = any (s.program_ids))
      and not exists (select 1 from bookings b where b.session_id = s.id and b.person_id = a.person_id)`;
    expect(orphan).toHaveLength(0);
    const future = await sql`select a.id from attendance a join class_sessions s on s.id = a.session_id where a.tenant_id = ${R} and s.starts_at > now()`;
    expect(future).toHaveLength(0);
  });

  it("rank ladders are contiguous (1..n) and enrollments hold ranks of their own program", async () => {
    const gaps = await sql`select program_id from ranks where tenant_id = ${R} group by program_id having max(position) <> count(*) or min(position) <> 1`;
    expect(gaps).toHaveLength(0);
    const wrong = await sql`select e.id from enrollments e join ranks r on r.id = e.current_rank_id where e.tenant_id = ${R} and r.program_id <> e.program_id`;
    expect(wrong).toHaveLength(0);
  });

  it("classes_since_promotion matches attendance since the last promotion", async () => {
    const off = await sql`select e.id from enrollments e where e.tenant_id = ${R} and e.classes_since_promotion <> (
      select count(*) from attendance a join class_sessions s on s.id = a.session_id
      where a.person_id = e.person_id and e.program_id = any (s.program_ids) and s.starts_at >= coalesce(e.last_promoted_at, e.started_at::timestamptz))`;
    expect(off).toHaveLength(0);
  });

  it("the demo accounts' family is in place (Cooper household, 2 kids, PIN set, a decaying student exists)", async () => {
    const kids = await sql`select p.first_name from household_members hm join people p on p.id = hm.person_id where hm.household_id = ${sid("household:ridgeline:cooper")} and hm.relationship = 'student' order by 1`;
    expect(kids.map((k) => k.first_name)).toEqual(["Leo", "Maya"]);
    const [pin] = await sql<{ ok: boolean }[]>`select pin_hash = extensions.crypt('4321', pin_hash) as ok from kiosk_pins where household_id = ${sid("household:ridgeline:cooper")}`;
    expect(pin?.ok).toBe(true);
  });

  it("is deterministic: re-running the demo seed creates no new rows", async () => {
    const before = await counts();
    const ctx = createSeedContext();
    ctx.log = () => undefined;
    try {
      await seedDemo(ctx);
    } finally {
      await ctx.sql.end();
    }
    expect(await counts()).toEqual(before);
  }, 120_000);
});
