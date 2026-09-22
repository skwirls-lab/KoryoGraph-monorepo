import { afterAll, describe, expect, it } from "vitest";
import { sql } from "./harness";

afterAll(async () => {
  await sql.end();
});

const EXPECTED_TABLES = [
  // 0002 platform
  "platform_admins", "modules", "plans", "plan_modules", "jobs", "tenants", "locations", "tenant_domains",
  "tenant_entitlements", "tenant_subscriptions", "job_runs", "api_keys", "webhook_endpoints", "webhook_deliveries",
  // 0003 identity
  "profiles", "permissions", "roles", "role_permissions", "tenant_users", "staff_invitations",
  // 0004 audit
  "audit_events",
];

describe("migrations", () => {
  it("create every expected table", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`;
    const present = new Set(rows.map((r) => r.table_name));
    expect(EXPECTED_TABLES.filter((t) => !present.has(t))).toEqual([]);
  });

  it("seed the module, plan and permission catalogues", async () => {
    const [counts] = await sql<{ modules: number; plans: number; permissions: number }[]>`
      select (select count(*)::int from public.modules) as modules,
             (select count(*)::int from public.plans) as plans,
             (select count(*)::int from public.permissions) as permissions`;
    expect(counts).toEqual({ modules: 9, plans: 4, permissions: 28 });
  });

  it("install the helper functions and the auth hook", async () => {
    const rows = await sql<{ fn: string }[]>`
      select n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('app', 'auth_hook')`;
    const fns = new Set(rows.map((r) => r.fn));
    for (const f of [
      "app.tenant_id", "app.user_id", "app.has_permission", "app.has_module", "app.is_platform_admin",
      "app.household_ids", "app.apply_tenant_policies", "app.setup_tenant_table", "app.create_tenant",
      "auth_hook.custom_access_token",
    ]) {
      expect(fns.has(f), f).toBe(true);
    }
  });
});
