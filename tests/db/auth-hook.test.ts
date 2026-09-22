import { afterAll, describe, expect, it } from "vitest";
import { addMember, createTenantWithOwner, createUser, signIn, sql, uniqueEmail } from "./harness";

afterAll(async () => {
  await sql.end();
});

describe("custom access token hook + create_tenant", () => {
  it("puts tenant, role, permissions and trial modules into the owner's JWT", async () => {
    const { tenantId, ownerEmail } = await createTenantWithOwner("Hook Test Dojang");
    const s = await signIn(ownerEmail);
    const meta = s.claims.app_metadata ?? {};
    expect(meta.tenant_id).toBe(tenantId);
    expect(meta.role).toBe("owner");
    expect(meta.permissions).toEqual(expect.arrayContaining(["desk.access", "billing.charge", "roles.manage"]));
    expect(meta.modules).toEqual(
      expect.arrayContaining(["core", "billing", "retail", "grow", "programs_plus", "home", "intelligence", "vision"]),
    );
  });

  it("gives a front-desk member desk access without medical or roles permissions", async () => {
    const { tenantId } = await createTenantWithOwner("Role Test Dojang");
    const email = await addMember(tenantId, "front_desk");
    const meta = (await signIn(email)).claims.app_metadata ?? {};
    expect(meta.role).toBe("front_desk");
    expect(meta.permissions).toContain("desk.access");
    expect(meta.permissions).not.toContain("people.medical.read");
    expect(meta.permissions).not.toContain("roles.manage");
  });

  it("omits tenant claims for a user with no membership", async () => {
    const email = uniqueEmail("loner");
    await createUser(email);
    const meta = (await signIn(email)).claims.app_metadata ?? {};
    expect(meta.tenant_id).toBeUndefined();
    expect(meta.permissions).toBeUndefined();
  });

  it("create_tenant seeds roles, default location, owner membership and a 14-day trial", async () => {
    const { tenantId } = await createTenantWithOwner("Seeded Defaults Academy");
    const [t] = await sql<{ slug: string; status: string; days: number; roles: number; locations: number; ents: number }[]>`
      select t.slug, t.status, round(extract(epoch from t.trial_ends_at - now()) / 86400)::int as days,
        (select count(*)::int from public.roles where tenant_id = t.id) as roles,
        (select count(*)::int from public.locations where tenant_id = t.id and is_default) as locations,
        (select count(*)::int from public.tenant_entitlements where tenant_id = t.id and source = 'trial') as ents
      from public.tenants t where t.id = ${tenantId}`;
    expect(t).toMatchObject({ status: "trial", days: 14, roles: 7, locations: 1, ents: 9 });
    expect(t?.slug).toMatch(/^seeded-defaults-academy/);
  });

  it("refuses to create a tenant on behalf of another user", async () => {
    const attacker = await createUser(uniqueEmail("attacker"));
    const victim = await createUser(uniqueEmail("victim"));
    const claims = JSON.stringify({ sub: attacker, role: "authenticated" });
    await expect(
      sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims}, true)`;
        await tx`set local role authenticated`;
        await tx`select app.create_tenant('Hijack', null, 'UTC', ${victim})`;
      }),
    ).rejects.toThrow(/not allowed to create a tenant for another user/);
    const [owned] = await sql<{ n: number }[]>`select count(*)::int as n from public.tenant_users where user_id = ${victim}`;
    expect(owned?.n).toBe(0);
  });

  it("rejects switching the active tenant to a tenant the user does not belong to", async () => {
    const { ownerEmail } = await createTenantWithOwner("Switch A");
    const { tenantId: other } = await createTenantWithOwner("Switch B");
    const s = await signIn(ownerEmail);
    const { error } = await s.client.rpc("switch_tenant", { p_tenant_id: other });
    expect(error?.message).toMatch(/not a member/);
  });
});
