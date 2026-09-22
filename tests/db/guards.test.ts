import { afterAll, describe, expect, it } from "vitest";
import { sql } from "./harness";

// §3.4 / Appendix B.2 guard tests. Each query must return zero rows; offenders are printed by name.
afterAll(async () => {
  await sql.end();
});

describe("schema guards", () => {
  it("(a) every table in public has RLS enabled", async () => {
    const rows = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("(b) no RLS table is without a policy", async () => {
    const rows = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("(c) every table with tenant_id has a policy predicated on app.tenant_id()", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select t.table_name from information_schema.columns t
      join information_schema.tables tb on tb.table_schema = t.table_schema and tb.table_name = t.table_name
      where t.table_schema = 'public' and t.column_name = 'tenant_id' and tb.table_type = 'BASE TABLE'
        and not exists (
          select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.table_name
            and (coalesce(p.qual, '') || coalesce(p.with_check, '')) ilike '%app.tenant_id()%')`;
    expect(rows.map((r) => r.table_name)).toEqual([]);
  });

  it("(d) tenant_id is not null on every tenant-scoped table", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select c.table_name from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'tenant_id' and c.is_nullable = 'YES' and tb.table_type = 'BASE TABLE'`;
    expect(rows.map((r) => r.table_name)).toEqual([]);
  });

  it("(e) every foreign key has a covering index", async () => {
    const rows = await sql<{ fk: string }[]>`
      select cl.relname || '.' || c.conname as fk
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace ns on ns.oid = cl.relnamespace
      where c.contype = 'f' and ns.nspname = 'public'
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
            and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] <@ c.conkey)`;
    expect(rows.map((r) => r.fk)).toEqual([]);
  });

  it("every view in public is security_invoker (RLS applies through views)", async () => {
    const rows = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v'
        and not coalesce(c.reloptions @> array['security_invoker=true'], false)`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("every tenant-scoped table (with an id) carries the audit trigger", async () => {
    const rows = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'audit_events'
        and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)
        and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'audit')`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
});
