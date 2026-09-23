import { afterAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");

afterAll(async () => {
  await sql.end();
});

describe("run_nl_report (nl_reader over tenant-scoped nl views)", () => {
  it("answers from the caller's tenant only, matching raw SQL", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const [row] = await asClaims(owner, (tx) => tx<{ r: { n: number }[] }[]>`select public.run_nl_report('select sum(check_ins)::int as n from v_attendance_weekly') as r`);
    const [truth] = await sql<{ n: number }[]>`select count(*)::int as n from attendance a join class_sessions s on s.id = a.session_id
      where s.tenant_id = ${R} and s.status <> 'cancelled' and s.starts_at <= now() and (cardinality(s.program_ids) <= 1)`;
    const [multi] = await sql<{ n: number }[]>`select coalesce(sum(cardinality(s.program_ids)), 0)::int as n from attendance a join class_sessions s on s.id = a.session_id
      where s.tenant_id = ${R} and s.status <> 'cancelled' and s.starts_at <= now() and cardinality(s.program_ids) > 1`;
    expect(row?.r[0]?.n ?? 0).toBe((truth?.n ?? 0) + (multi?.n ?? 0));
    const harbor = await seededClaims("owner@harborbjj.demo");
    const [h] = await asClaims(harbor, (tx) => tx<{ r: { n: number }[] }[]>`select public.run_nl_report('select count(*)::int as n from v_members where display_name like ''Maya%''') as r`);
    expect(h?.r[0]?.n).toBe(0);
  });

  it("can't reach base tables, other schemas or writes; non-report users are refused", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const run = (q: string) => asClaims(owner, (tx) => tx`select public.run_nl_report(${q})`);
    await expect(run("select * from public.people")).rejects.toThrow(/permission denied/);
    await expect(run("select * from public.v_member_roster")).rejects.toThrow(/permission denied/);
    await expect(run("select * from auth.users")).rejects.toThrow(/permission denied/);
    await expect(run("select 1; delete from public.people")).rejects.toThrow(/single SELECT/);
    await expect(run("with d as (delete from public.notes returning 1) select * from d")).rejects.toThrow(/read-only|permission denied|data-modifying/);
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.run_nl_report('select * from v_members')`)).rejects.toMatchObject({ code: "42501" });
    // Direct access to the nl views (outside the runner) is closed.
    await expect(asClaims(owner, (tx) => tx`select * from nl.v_members`)).rejects.toThrow(/permission denied/);
  });
});

describe("run_nl_report guard", () => {
  it("refuses attempts to rewrite the session or reach catalogs, however they're spelled", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const harborTenant = sid("tenant:harbor");
    const forged = JSON.stringify({ app_metadata: { tenant_id: harborTenant, permissions: ["reports.read"] } });
    for (const q of [
      `select * from v_members where set_config('request.jwt.claims', '${forged}', true) is not null`,
      `select * from v_members where "set_config"('request.jwt.claims', '${forged}', true) is not null`,
      `select * from v_members where pg_catalog.set_config('x', 'y', true) is not null`,
      `select current_setting('request.jwt.claims')`,
      `select * from pg_tables`,
      `select * from U&"v_members"`,
    ]) {
      await expect(asClaims(owner, (tx) => tx`select public.run_nl_report(${q})`), q).rejects.toThrow(/can't use|single SELECT/);
    }
  });
});
