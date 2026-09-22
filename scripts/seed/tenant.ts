import { sid } from "../lib/ids";
import { ensureUser, type SeedContext } from "./context";

export interface SeedTenantSpec {
  key: string;
  name: string;
  slug: string;
  timezone: string;
  plan: string;
  terminology?: Record<string, string>;
  theme?: string;
  location: { name: string; rooms: string[]; phone?: string; address?: Record<string, string> };
}

const SYSTEM_ROLES = [
  ["owner", "Owner", "desk", "Full access, including billing, roles and settings."],
  ["admin", "Admin", "desk", "Everything except editing roles."],
  ["front_desk", "Front desk", "desk", "People, attendance, payments, POS, CRM and messaging."],
  ["instructor", "Instructor", "mat", "Classes, attendance, curriculum, promotions and testing."],
  ["assistant_instructor", "Assistant instructor", "mat", "Class rosters and attendance."],
  ["parent", "Parent / guardian", "home", "Family progress, schedule, billing and messages."],
  ["student", "Student", "home", "Own progress, schedule and messages."],
] as const;

export type RoleKey = (typeof SYSTEM_ROLES)[number][0];

/**
 * Deterministic equivalent of app.create_tenant for seeding: explicit ids everywhere, active status,
 * entitlements from a platform plan (not a trial). Permission sets come from app.default_role_permissions
 * so seeds and self-serve tenants never drift.
 */
export async function seedTenant(ctx: SeedContext, spec: SeedTenantSpec): Promise<{ tenantId: string; locationId: string }> {
  const tenantId = sid(`tenant:${spec.key}`);
  const locationId = sid(`location:${spec.key}:main`);
  const { sql } = ctx;

  await sql`
    insert into public.tenants (id, name, slug, timezone, status, branding, terminology, onboarding)
    values (${tenantId}, ${spec.name}, ${spec.slug}, ${spec.timezone}, 'active',
      ${sql.json({ theme: spec.theme ?? "koryo-red" })},
      ${sql.json(spec.terminology ?? { school: "dojang", rank: "belt", form: "poomsae" })},
      ${sql.json({ steps: { location: true, programs: false, schedule: false, students: false, payments: false, staff: false, branding: false }, dismissed: false })})
    on conflict (id) do nothing`;

  await sql`
    insert into public.locations (id, tenant_id, name, timezone, is_default, phone, address, rooms)
    values (${locationId}, ${tenantId}, ${spec.location.name}, ${spec.timezone}, true, ${spec.location.phone ?? null},
      ${sql.json(spec.location.address ?? {})}, ${sql.json(spec.location.rooms)})
    on conflict (id) do nothing`;

  for (const [key, name, surface, description] of SYSTEM_ROLES) {
    const roleId = sid(`role:${spec.key}:${key}`);
    await sql`
      insert into public.roles (id, tenant_id, key, name, surface, is_system, description)
      values (${roleId}, ${tenantId}, ${key}, ${name}, ${surface}, true, ${description})
      on conflict (id) do nothing`;
    await sql`
      insert into public.role_permissions (tenant_id, role_id, permission_key)
      select ${tenantId}, ${roleId}, p from unnest(app.default_role_permissions(${key})) as p
      on conflict do nothing`;
  }

  await sql`
    insert into public.tenant_entitlements (id, tenant_id, module_key, source, starts_at)
    select extensions.uuid_generate_v5(${tenantId}::uuid, pm.module_key), ${tenantId}, pm.module_key, 'plan', '2024-01-01'::timestamptz
    from public.plan_modules pm where pm.plan_key = ${spec.plan}
    on conflict (tenant_id, module_key) do nothing`;

  await sql`
    insert into public.tenant_subscriptions (id, tenant_id, plan_key, status, current_period_end)
    values (${sid(`subscription:${spec.key}`)}, ${tenantId}, ${spec.plan}, 'active', now() + interval '30 days')
    on conflict (tenant_id) do nothing`;

  return { tenantId, locationId };
}

/** Create a login and attach it to the tenant with a role; sets the active tenant. */
export async function seedMember(ctx: SeedContext, tenantKey: string, role: RoleKey, email: string, fullName: string): Promise<string> {
  const userId = await ensureUser(ctx, email, fullName);
  const tenantId = sid(`tenant:${tenantKey}`);
  await ctx.sql`
    insert into public.tenant_users (id, tenant_id, user_id, role_id, status, accepted_at)
    values (${sid(`tenant_user:${tenantKey}:${email}`)}, ${tenantId}, ${userId}, ${sid(`role:${tenantKey}:${role}`)}, 'active', '2024-01-01')
    on conflict (tenant_id, user_id) do nothing`;
  await ctx.sql`update public.profiles set active_tenant_id = ${tenantId}, full_name = ${fullName} where id = ${userId}`;
  return userId;
}
