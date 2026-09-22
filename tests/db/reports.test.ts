import { unzipSync, strFromU8 } from "fflate";
import { afterAll, describe, expect, it } from "vitest";
import { runJob } from "@/server/jobs/runner";
import { sid } from "../../scripts/lib/ids";
import { admin, asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");

afterAll(async () => {
  await sql.end();
});

describe("owner dashboard", () => {
  it("matches SQL truth computed independently", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const [view] = await asClaims(owner, (tx) => tx<Record<string, number>[]>`select * from public.v_owner_dashboard where tenant_id = ${R}`);
    const [truth] = await sql<Record<string, number>[]>`
      with w as (select (date_trunc('week', now() at time zone 'America/New_York')) at time zone 'America/New_York' as ws)
      select
        (select count(*) from people where tenant_id = ${R} and status = 'active' and 'student' = any(type_flags) and archived_at is null)::int as active_students,
        (select count(*) from people where tenant_id = ${R} and status = 'trial' and archived_at is null)::int as trials,
        (select count(*) from attendance a join class_sessions s on s.id = a.session_id, w where a.tenant_id = ${R} and s.starts_at >= w.ws and s.starts_at < w.ws + interval '7 days')::int as attendance_this_week,
        (select count(*) from attendance a join class_sessions s on s.id = a.session_id, w where a.tenant_id = ${R} and s.starts_at >= w.ws - interval '7 days' and s.starts_at < w.ws)::int as attendance_last_week`;
    expect(view).toMatchObject(truth ?? {});
  });

  it("is invisible across tenants", async () => {
    const harbor = await seededClaims("owner@harborbjj.demo");
    const rows = await asClaims(harbor, (tx) => tx`select * from public.v_owner_dashboard where tenant_id = ${R}`);
    expect(rows).toHaveLength(0);
  });
});

describe("full data export", () => {
  it("zips one JSON file per tenant-scoped table with exact row counts and redacted secrets", async () => {
    const [ex] = await sql<{ id: string }[]>`insert into public.exports (tenant_id, kind) values (${R}, 'full') returning id`;
    const r = await runJob("data_export", { tenantId: R, params: { export: ex?.id ?? "" } });
    expect(r.status).toBe("ok");
    const [row] = await sql<{ status: string; file_path: string }[]>`select status, file_path from public.exports where id = ${ex?.id ?? ""}`;
    expect(row?.status).toBe("ready");
    const { data: blob, error } = await admin.storage.from("tenant-media").download(row?.file_path ?? "");
    expect(error).toBeNull();
    const files = unzipSync(new Uint8Array(await (blob as Blob).arrayBuffer()));
    const tables = await sql<{ table_name: string }[]>`
      select c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE'`;
    expect(Object.keys(files).sort()).toEqual([...tables.map((t) => `${t.table_name}.json`), "README.txt", "tenant.json"].sort());
    for (const { table_name } of tables) {
      const rows = JSON.parse(strFromU8(files[`${table_name}.json`] as Uint8Array)) as Record<string, unknown>[];
      const [c] = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(table_name)} where tenant_id = ${R}`;
      if (table_name === "audit_events" || table_name === "exports") expect(rows.length).toBeLessThanOrEqual(c?.n ?? 0);
      else expect(rows.length, table_name).toBe(c?.n);
      for (const rr of rows) for (const k of ["token_hash", "pin_hash", "key_hash", "secret"]) if (k in rr) expect(rr[k]).toBe("[redacted]");
    }
  });
});
