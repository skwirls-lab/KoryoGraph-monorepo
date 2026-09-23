import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createTenantWithOwner, sql } from "./harness";

const run = randomUUID().replace(/-/g, "").slice(0, 24);
const mk = (c: string) => `kg_live_${c.repeat(8)}_${(c.repeat(8) + run).slice(0, 32)}`;
const hash = (k: string) => createHash("sha256").update(k).digest("hex");
const asAnon = <T>(fn: (tx: typeof sql) => Promise<T>) => sql.begin(async (tx) => { await tx`set local role anon`; return fn(tx as unknown as typeof sql); }) as Promise<T>;

afterAll(async () => {
  await sql.end();
});

describe("public API (api_list)", () => {
  it("scopes rows to the key's school, honours scopes and revocation, and rate-limits at 120/min", async () => {
    const a = await createTenantWithOwner("API School A");
    const b = await createTenantWithOwner("API School B");
    await sql`insert into people (tenant_id, type_flags, first_name, last_name, status) values (${a.tenantId}, '{student}', 'Ann', 'Alpha', 'active'), (${b.tenantId}, '{student}', 'Ben', 'Beta', 'active')`;
    const ka = mk("a"), kb = mk("b");
    await sql`insert into api_keys (tenant_id, name, key_hash, prefix, scopes) values
      (${a.tenantId}, 'A', ${hash(ka)}, 'kg_live_aaaaaaaa', ${["people:read"]}), (${b.tenantId}, 'B', ${hash(kb)}, 'kg_live_bbbbbbbb', ${["people:read"]})`;
    const list = (k: string, resource = "people") => asAnon((tx) => tx<{ r: { data: { last_name: string }[] } }[]>`select public.api_list(${k}, ${resource}, null, 200, '{}') as r`);
    expect((await list(ka))[0]?.r.data.map((p) => p.last_name)).toEqual(["Alpha"]);
    expect((await list(kb))[0]?.r.data.map((p) => p.last_name)).toEqual(["Beta"]);
    await expect(list(ka, "invoices")).rejects.toMatchObject({ code: "42501" });
    await expect(list(mk("z"))).rejects.toMatchObject({ code: "28000" });
    // anon can't read the tables directly
    expect(await asAnon((tx) => tx`select id from api_keys`)).toHaveLength(0); // RLS: nothing visible without the function
    await sql`update api_keys set revoked_at = now() where key_hash = ${hash(kb)}`;
    await expect(list(kb)).rejects.toMatchObject({ code: "28000" });
    // Rate limit: request 121 in the same minute is refused.
    await sql`insert into app.api_rate (key_id, window_start, count) select id, date_trunc('minute', now()), 119 from api_keys where key_hash = ${hash(ka)}
      on conflict (key_id, window_start) do update set count = 119`;
    await list(ka);
    await expect(list(ka)).rejects.toMatchObject({ code: "54000" });
  });

  it("webhook events are queued only for subscribed, active endpoints of the same school", async () => {
    const a = await createTenantWithOwner("Hook School");
    const [ep] = await sql<{ id: string }[]>`insert into webhook_endpoints (tenant_id, url, secret, events) values (${a.tenantId}, 'https://example.test/h', 'whsec_x', ${["member.created"]}) returning id`;
    await sql`insert into webhook_endpoints (tenant_id, url, secret, events, active) values (${a.tenantId}, 'https://example.test/off', 'whsec_y', ${["member.created"]}, false)`;
    await sql`insert into people (tenant_id, type_flags, first_name, last_name, status) values (${a.tenantId}, '{student}', 'Hal', 'Hook', 'active'), (${a.tenantId}, '{guardian}', 'Gia', 'Hook', 'guardian_only')`;
    const q = await sql<{ endpoint_id: string; event: string; name: string }[]>`select endpoint_id, event, payload #>> '{data,first_name}' as name from webhook_deliveries where tenant_id = ${a.tenantId}`;
    expect(q).toEqual([{ endpoint_id: ep?.id, event: "member.created", name: "Hal" }]);
  });
});
