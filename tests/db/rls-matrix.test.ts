import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROLE_ACCOUNTS, accountEmail } from "../../scripts/seed/accounts";
import { DEMO_PASSWORD } from "../../scripts/seed/context";
import { sid } from "../../scripts/lib/ids";
import { signIn, sql } from "./harness";

// §3.4 RLS matrix: two seeded tenants, every role of each. For every table with tenant_id:
// cross-tenant SELECT returns 0 rows and cross-tenant INSERT is rejected by RLS (SQLSTATE 42501).
// Claims are the real ones minted by the auth hook at sign-in.

const A = sid("tenant:ridgeline");
const B = sid("tenant:harbor");

interface Actor {
  tenant: "ridgeline" | "harbor";
  role: string;
  claims: Record<string, unknown>;
}

const actors: Actor[] = [];
let tables: string[] = [];

async function asActor<T>(actor: Actor, fn: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(actor.claims)}, true)`;
    await tx`set local role authenticated`;
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}

beforeAll(async () => {
  for (const tenant of ["ridgeline", "harbor"] as const) {
    for (const a of ROLE_ACCOUNTS) {
      const s = await signIn(accountEmail(tenant, a.local), DEMO_PASSWORD);
      actors.push({ tenant, role: a.role, claims: s.claims });
    }
  }
  const rows = await sql<{ table_name: string }[]>`
    select c.table_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE'
    order by 1`;
  tables = rows.map((r) => r.table_name);
}, 120_000);

afterAll(async () => {
  await sql.end();
});

describe("RLS matrix", () => {
  it("covers every tenant-scoped table and both seeded tenants", () => {
    expect(tables.length).toBeGreaterThan(10);
    expect(actors).toHaveLength(ROLE_ACCOUNTS.length * 2);
    for (const a of actors) {
      const meta = a.claims.app_metadata as { tenant_id?: string; role?: string };
      expect(meta.tenant_id).toBe(a.tenant === "ridgeline" ? A : B);
      expect(meta.role).toBe(a.role);
    }
  });

  it("positive control: every actor sees its own tenant's roles and memberships", async () => {
    for (const actor of actors) {
      const own = actor.tenant === "ridgeline" ? A : B;
      const [r] = await asActor(actor, (tx) => tx<{ roles: number; members: number }[]>`
        select (select count(*)::int from public.roles where tenant_id = ${own}) as roles,
               (select count(*)::int from public.tenant_users where tenant_id = ${own}) as members`);
      expect(r?.roles, `${actor.tenant}/${actor.role} roles`).toBe(7);
      expect(r?.members, `${actor.tenant}/${actor.role} members`).toBeGreaterThanOrEqual(ROLE_ACCOUNTS.length);
    }
  });

  it("no role can read another tenant's rows in any table", async () => {
    const leaks: string[] = [];
    for (const actor of actors) {
      const other = actor.tenant === "ridgeline" ? B : A;
      for (const table of tables) {
        const [row] = await asActor(actor, (tx) => tx<{ n: number }[]>`select count(*)::int as n from ${tx(table)} where tenant_id = ${other}`);
        if ((row?.n ?? 0) > 0) leaks.push(`${actor.tenant}/${actor.role} sees ${row?.n} ${table} rows of the other tenant`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("no role can insert a row into another tenant", async () => {
    const accepted: string[] = [];
    for (const actor of actors) {
      const other = actor.tenant === "ridgeline" ? B : A;
      for (const table of tables) {
        try {
          await asActor(actor, (tx) => tx`insert into ${tx(table)} (tenant_id) values (${other})`);
          accepted.push(`${actor.tenant}/${actor.role} inserted into ${table}`);
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code !== "42501") accepted.push(`${actor.tenant}/${actor.role} → ${table}: expected RLS rejection, got ${code} ${(err as Error).message}`);
        }
      }
    }
    expect(accepted).toEqual([]);
  });

  it("the other tenant's record and its members' profiles are invisible", async () => {
    for (const actor of actors) {
      const other = actor.tenant === "ridgeline" ? B : A;
      const [t] = await asActor(actor, (tx) => tx<{ n: number }[]>`select count(*)::int as n from public.tenants where id = ${other}`);
      expect(t?.n, `${actor.tenant}/${actor.role} tenants`).toBe(0);
      const [p] = await asActor(actor, (tx) => tx<{ n: number }[]>`
        select count(*)::int as n from public.profiles p
        where p.id in (select tu.user_id from public.tenant_users tu where tu.tenant_id = ${other})`);
      expect(p?.n, `${actor.tenant}/${actor.role} profiles`).toBe(0);
    }
  });

  it("same-tenant writes still require the permission (front desk cannot edit roles)", async () => {
    const frontDesk = actors.find((a) => a.tenant === "ridgeline" && a.role === "front_desk");
    if (!frontDesk) throw new Error("front desk actor missing");
    const res = await asActor(frontDesk, (tx) => tx`update public.roles set name = 'Hacked' where tenant_id = ${A} returning id`);
    expect(res.length).toBe(0);
  });
});
