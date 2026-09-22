import { afterAll, describe, expect, it } from "vitest";
import { createSeedContext } from "../../scripts/seed/context";
import { seedMinimal } from "../../scripts/seed/minimal";
import { sql } from "./harness";

afterAll(async () => {
  await sql.end();
});

async function fingerprint(): Promise<Record<string, string>> {
  const rows = await sql<{ t: string; fp: string }[]>`
    select 'tenants' as t, string_agg(id::text, ',' order by id) as fp from public.tenants where slug in ('ridgeline', 'harbor')
    union all select 'roles', string_agg(id::text, ',' order by id) from public.roles where tenant_id in (select id from public.tenants where slug in ('ridgeline', 'harbor'))
    union all select 'tenant_users', string_agg(id::text, ',' order by id) from public.tenant_users where tenant_id in (select id from public.tenants where slug in ('ridgeline', 'harbor'))
    union all select 'role_permissions', count(*)::text from public.role_permissions where tenant_id in (select id from public.tenants where slug in ('ridgeline', 'harbor'))`;
  return Object.fromEntries(rows.map((r) => [r.t, r.fp]));
}

describe("seed", () => {
  it("minimal profile is idempotent and deterministic (re-running changes nothing)", async () => {
    const before = await fingerprint();
    const ctx = createSeedContext();
    ctx.log = () => undefined;
    await seedMinimal(ctx);
    await ctx.sql.end();
    expect(await fingerprint()).toEqual(before);
    expect(before.tenants?.split(",")).toHaveLength(2);
  });
});
