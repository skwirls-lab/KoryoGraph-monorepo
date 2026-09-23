import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@koryo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const token = randomBytes(32).toString("base64url");
let deviceId = "";
const started = new Date();
let instructor = "";
let owner = "";
const created: { memberships: string[]; sales: string[] } = { memberships: [], sales: [] };

beforeAll(async () => {
  const [d] = await sql<{ id: string }[]>`insert into kiosk_devices (tenant_id, location_id, name, token_hash)
    values (${R}, ${sid("location:ridgeline:main")}, 'db-test staff kiosk', ${createHash("sha256").update(token).digest("hex")}) returning id`;
  deviceId = d?.id ?? "";
  [{ id: instructor } = { id: "" }] = await sql<{ id: string }[]>`select id from auth.users where email = 'instructor@ridgelinetkd.demo'`;
  [{ id: owner } = { id: "" }] = await sql<{ id: string }[]>`select id from auth.users where email = 'owner@ridgelinetkd.demo'`;
});

afterAll(async () => {
  await sql`delete from kiosk_devices where id = ${deviceId}`;
  await sql`delete from time_entries where user_id in (${instructor}, ${owner}) and created_at >= ${started}`;
  await sql`delete from staff_pins where user_id = ${instructor}`;
  const refs: string[] = [...created.memberships, ...created.sales, randomUUID()];
  await sql`delete from commissions where ref_id = any(${refs}::uuid[])`;
  if (created.sales.length) await sql`delete from pos_sales where id in ${sql(created.sales)}`;
  if (created.memberships.length) await sql`delete from memberships where id in ${sql(created.memberships)}`;
  await sql`delete from staff_profiles where tenant_id = ${R} and user_id = ${owner}`;
  await sql.end();
});

describe("staff PINs and the kiosk time clock", () => {
  it("only the staff member or staff.manage sets a PIN; the hash is never readable", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.set_staff_pin(${instructor}, '4321')`)).rejects.toMatchObject({ code: "42501" });
    const inst = await seededClaims("instructor@ridgelinetkd.demo");
    await expect(asClaims(inst, (tx) => tx`select public.set_staff_pin(${owner}, '4321')`)).rejects.toMatchObject({ code: "42501" });
    await asClaims(inst, (tx) => tx`select public.set_staff_pin(${instructor}, '4321')`);
    const own = await seededClaims("owner@ridgelinetkd.demo");
    await expect(asClaims(own, (tx) => tx`select public.set_staff_pin(${instructor}, '12')`)).rejects.toThrow(/4 digits/);
    await asClaims(own, (tx) => tx`select public.set_staff_pin(${instructor}, '2468')`);
    await expect(asClaims(own, (tx) => tx`select pin_hash from staff_pins`)).rejects.toThrow(/permission denied/);
    const meta = await asClaims(own, (tx) => tx`select user_id from staff_pins where user_id = ${instructor}`);
    expect(meta).toHaveLength(1);
  });

  it("clocks in and out at the kiosk; wrong PINs lock after five tries", async () => {
    const list = await anon.rpc("kiosk_staff", { p_token: token });
    expect(list.error).toBeNull();
    expect((list.data ?? []).map((s) => s.display_name)).toContain("Sabumnim Grace P.");
    const clock = (pin: string) => anon.rpc("kiosk_staff_clock", { p_token: token, p_user_id: instructor, p_pin: pin });
    const bad = await clock("0000");
    expect(bad.data?.[0]).toMatchObject({ ok: false, attempts_left: 4 });
    const inR = await clock("2468");
    expect(inR.data?.[0]).toMatchObject({ ok: true, action: "in" });
    const outR = await clock("2468");
    expect(outR.data?.[0]).toMatchObject({ ok: true, action: "out" });
    const [e] = await sql`select source, clock_out is not null as closed, location_id from time_entries where user_id = ${instructor} order by created_at desc limit 1`;
    expect(e).toEqual({ source: "kiosk", closed: true, location_id: sid("location:ridgeline:main") });
    for (let i = 0; i < 4; i++) await clock("1111");
    const locked = await clock("1111");
    expect(locked.data?.[0]?.locked_until).toBeTruthy();
    const stillLocked = await clock("2468");
    expect(stillLocked.data?.[0]).toMatchObject({ ok: false });
    await sql`update staff_pins set locked_until = null, failed_attempts = 0 where user_id = ${instructor}`;
  });

  it("staff see only their own time entries; staff.manage sees everyone's", async () => {
    await sql`insert into time_entries (tenant_id, user_id, clock_in, clock_out, source) values (${R}, ${owner}, now() - interval '3 hours', now() - interval '1 hour', 'desk')`;
    const inst = await seededClaims("instructor@ridgelinetkd.demo");
    const mine = await asClaims(inst, (tx) => tx<{ user_id: string }[]>`select user_id from time_entries`);
    expect(mine.every((r) => r.user_id === instructor)).toBe(true);
    const own = await seededClaims("owner@ridgelinetkd.demo");
    const all = await asClaims(own, (tx) => tx<{ user_id: string }[]>`select distinct user_id from time_entries`);
    expect(all.map((r) => r.user_id)).toEqual(expect.arrayContaining([owner, instructor]));
  });
});

describe("commissions and payroll", () => {
  it("a sold membership and a completed POS sale earn the seller's commission", async () => {
    await sql`insert into staff_profiles (tenant_id, user_id, pay_rates) values (${R}, ${owner}, '{"commission_pct": 10, "hourly_cents": 2000, "per_class_cents": 3000}')
              on conflict (tenant_id, user_id) do update set pay_rates = excluded.pay_rates`;
    const own = await seededClaims("owner@ridgelinetkd.demo");
    const [plan] = await sql<{ id: string; price_cents: number }[]>`select id, price_cents from membership_plans where tenant_id = ${R} and kind = 'recurring' and price_cents > 0 order by price_cents limit 1`;
    const [m] = await asClaims(own, (tx) => tx<{ id: string }[]>`insert into memberships (tenant_id, household_id, person_id, plan_id, status, starts_at)
      select ${R}, household_id, ${MAYA}, ${plan?.id ?? ""}, 'pending', current_date from household_members where person_id = ${MAYA} limit 1 returning id`);
    created.memberships.push(m?.id ?? "");
    const [c] = await sql`select user_id, amount_cents, rate_pct::float as pct from commissions where ref_type = 'membership' and ref_id = ${m?.id ?? ""}`;
    expect(c).toEqual({ user_id: owner, amount_cents: Math.round((plan?.price_cents ?? 0) / 10), pct: 10 });

    const [s] = await sql<{ id: string }[]>`insert into pos_sales (tenant_id, location_id, cashier_user_id, subtotal_cents, discount_cents, tax_cents, total_cents)
      values (${R}, ${sid("location:ridgeline:main")}, ${owner}, 5000, 500, 0, 4500) returning id`;
    created.sales.push(s?.id ?? "");
    await sql`update pos_sales set status = 'completed' where id = ${s?.id ?? ""}`;
    const [pc] = await sql`select amount_cents from commissions where ref_type = 'pos_sale' and ref_id = ${s?.id ?? ""}`;
    expect(pc?.amount_cents).toBe(450);
  });

  it("v_payroll = hours × hourly + sessions × per-class + commissions, sessions from v_instructor_sessions", async () => {
    const own = await seededClaims("owner@ridgelinetkd.demo");
    const rows = await asClaims(own, (tx) => tx<{ period: string; hours: string; hourly_pay_cents: number; sessions: number; class_pay_cents: number; commission_cents: number; total_cents: number }[]>`
      select * from v_payroll where user_id = ${owner}`);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.hourly_pay_cents).toBe(Math.round(Number(r.hours) * 2000));
      expect(r.class_pay_cents).toBe(r.sessions * 3000);
      expect(r.total_cents).toBe(r.hourly_pay_cents + r.class_pay_cents + r.commission_cents);
    }
    const [direct] = await sql<{ n: number }[]>`select count(*)::int as n from class_sessions s where s.tenant_id = ${R} and s.status <> 'cancelled' and s.starts_at <= now()
      and ${owner}::uuid = any (case when cardinality(s.substitute_ids) > 0 then s.substitute_ids else s.instructor_ids end)`;
    const [viewTotal] = await sql<{ n: number }[]>`select coalesce(sum(sessions), 0)::int as n from v_instructor_sessions where user_id = ${owner}`;
    expect(viewTotal?.n).toBe(direct?.n);
    const inst = await seededClaims("instructor@ridgelinetkd.demo");
    const theirs = await asClaims(inst, (tx) => tx<{ user_id: string }[]>`select user_id from v_payroll`);
    expect(theirs.every((r) => r.user_id === instructor)).toBe(true);
  });
});
