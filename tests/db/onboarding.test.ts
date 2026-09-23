import { afterAll, describe, expect, it } from "vitest";
import { addMember, asClaims, createTenantWithOwner, createUser, mintSession, sql, uniqueEmail } from "./harness";

afterAll(async () => {
  await sql.end();
});

describe("onboarding RPCs", () => {
  it("go live: only settings managers; the plan's modules replace the trial; unknown plans refused", async () => {
    const { tenantId, ownerEmail } = await createTenantWithOwner("Go Live Dojo");
    const deskEmail = await addMember(tenantId, "front_desk");
    const desk = (await mintSession(deskEmail)).claims;
    await expect(asClaims(desk, (tx) => tx`select public.go_live('studio', '{}', 'monthly')`)).rejects.toMatchObject({ code: "42501" });
    const owner = (await mintSession(ownerEmail)).claims;
    await expect(asClaims(owner, (tx) => tx`select public.go_live('platinum', '{}', 'monthly')`)).rejects.toThrow(/unknown plan/);
    await asClaims(owner, (tx) => tx`select public.go_live(null, array['retail'], 'annual')`);
    const live = await sql<{ module_key: string; source: string }[]>`select module_key, source from tenant_entitlements where tenant_id = ${tenantId} and (ends_at is null or ends_at > now()) order by 1`;
    expect(live).toEqual([{ module_key: "core", source: "addon" }, { module_key: "retail", source: "addon" }]);
    const [t] = await sql<{ status: string; plan: string | null; audited: number }[]>`
      select t.status, s.plan_key as plan, (select count(*)::int from audit_events a where a.tenant_id = t.id and a.note = 'go_live') as audited
      from tenants t join tenant_subscriptions s on s.tenant_id = t.id where t.id = ${tenantId}`;
    expect(t).toEqual({ status: "active", plan: null, audited: 1 });
  });

  it("an invitation can only be accepted by the invited user", async () => {
    const { tenantId } = await createTenantWithOwner("Invite Dojo");
    const inviteeEmail = uniqueEmail("invitee");
    const invitee = await createUser(inviteeEmail);
    const [tu] = await sql<{ id: string }[]>`insert into tenant_users (tenant_id, user_id, role_id, status, invited_email)
      select ${tenantId}, ${invitee}, id, 'invited', ${inviteeEmail} from roles where tenant_id = ${tenantId} and key = 'instructor' returning id`;
    const other = await createUser(uniqueEmail("other"));
    await expect(asClaims({ sub: other, role: "authenticated" }, (tx) => tx`select public.accept_invitation(${tu?.id ?? ""})`)).rejects.toThrow(/no longer open/);
    const mine = await asClaims({ sub: invitee, role: "authenticated" }, (tx) => tx<{ tenant_name: string }[]>`select tenant_name from public.my_invitations()`);
    expect(mine).toEqual([{ tenant_name: "Invite Dojo" }]);
    await asClaims({ sub: invitee, role: "authenticated" }, (tx) => tx`select public.accept_invitation(${tu?.id ?? ""})`);
    const [row] = await sql<{ status: string }[]>`select status from tenant_users where id = ${tu?.id ?? ""}`;
    expect(row?.status).toBe("active");
  });
});
