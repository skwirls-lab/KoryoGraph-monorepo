import { describe, expect, it } from "vitest";
import { validateReportSql } from "./sql-guard";

const ok = (s: string) => validateReportSql(s);

describe("validateReportSql", () => {
  it("accepts a grouped SELECT over report views and adds a LIMIT", () => {
    const r = ok("select week_start, program, sum(check_ins) as check_ins from v_attendance_weekly where week_start >= current_date - 56 group by 1, 2 order by 1");
    expect(r).toMatchObject({ ok: true, views: ["v_attendance_weekly"] });
    if (r.ok) expect(r.sql.endsWith("limit 5000")).toBe(true);
    expect(ok("with w as (select program, sum(check_ins) as n from nl.v_attendance_weekly group by 1) select * from w order by n desc limit 10;")).toMatchObject({ ok: true });
    expect(ok("select round(avg(age)::numeric(10,1), 1) from v_members where status = 'active'")).toMatchObject({ ok: true });
    expect(ok("select count(*) filter (where status = 'delete me') from v_members")).toMatchObject({ ok: true }); // words inside strings are fine
  });
  it("rejects writes and anything that isn't a single SELECT", () => {
    expect(ok("delete from v_members")).toMatchObject({ ok: false });
    expect(ok("select 1 from v_members; drop table people")).toMatchObject({ ok: false, error: expect.stringMatching(/one statement/) });
    expect(ok("with d as (delete from v_members returning 1) select * from d")).toMatchObject({ ok: false });
    expect(ok("select * into x from v_members")).toMatchObject({ ok: false });
    expect(ok("")).toMatchObject({ ok: false });
  });
  it("rejects base tables, other schemas and unknown views, including via joins", () => {
    expect(ok("select * from people")).toMatchObject({ ok: false, error: expect.stringMatching(/report views/) });
    expect(ok("select * from v_members m join invoices i on true")).toMatchObject({ ok: false });
    expect(ok("select * from public.v_member_roster")).toMatchObject({ ok: false });
    expect(ok("select * from pg_tables")).toMatchObject({ ok: false });
    expect(ok("select 1")).toMatchObject({ ok: false, error: expect.stringMatching(/doesn't read/) });
  });
  it("rejects disallowed functions, session tricks, comments and escapes", () => {
    expect(ok("select pg_sleep(10) from v_members")).toMatchObject({ ok: false });
    expect(ok("select set_config('a', 'b', true) from v_members")).toMatchObject({ ok: false });
    expect(ok("select current_setting('request.jwt.claims') from v_members")).toMatchObject({ ok: false });
    expect(ok("select md5(display_name) from v_members")).toMatchObject({ ok: false, error: expect.stringMatching(/md5/) });
    expect(ok("select * from v_members -- hi")).toMatchObject({ ok: false });
    expect(ok('select * from "v_members"')).toMatchObject({ ok: false });
    expect(ok("select * from U&v_members")).toMatchObject({ ok: false });
    expect(ok("select $$x$$ from v_members")).toMatchObject({ ok: false });
  });
  it("caps LIMIT", () => {
    expect(ok("select * from v_members limit 100")).toMatchObject({ ok: true });
    expect(ok("select * from v_members limit 50000")).toMatchObject({ ok: false, error: expect.stringMatching(/5000/) });
  });
});
