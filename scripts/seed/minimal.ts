import { sid } from "../lib/ids";
import { ROLE_ACCOUNTS, TENANTS, PLATFORM_ADMIN_EMAIL, accountEmail } from "./accounts";
import { ensureUser, type SeedContext } from "./context";
import { seedMember, seedTenant } from "./tenant";

/**
 * `minimal`: two tenants (Ridgeline Taekwondo on the full plan, Harbor BJJ on core only), one login per
 * role in each, one location each, and a platform admin. The base every other profile builds on.
 */
export async function seedMinimal(ctx: SeedContext): Promise<void> {
  await seedTenant(ctx, {
    key: "ridgeline",
    name: TENANTS.ridgeline.name,
    slug: TENANTS.ridgeline.slug,
    timezone: "America/New_York",
    plan: TENANTS.ridgeline.plan,
    theme: "koryo-red",
    location: {
      name: "Main Dojang",
      rooms: ["Main mat", "Studio B"],
      phone: "(555) 010-2040",
      address: { line1: "120 Ridgeline Ave", city: "Springfield", region: "VA", postal_code: "22150", country: "US" },
    },
  });
  await seedTenant(ctx, {
    key: "harbor",
    name: TENANTS.harbor.name,
    slug: TENANTS.harbor.slug,
    timezone: "America/Los_Angeles",
    plan: TENANTS.harbor.plan,
    theme: "midnight",
    terminology: { school: "academy", rank: "belt", form: "technique" },
    location: { name: "Harbor Academy", rooms: ["Mat room"], phone: "(555) 010-7788", address: { line1: "8 Pier Rd", city: "Seaside", region: "CA", postal_code: "93955", country: "US" } },
  });
  ctx.log("tenants: ridgeline, harbor");

  for (const tenant of ["ridgeline", "harbor"] as const) {
    for (const a of ROLE_ACCOUNTS) {
      await seedMember(ctx, tenant, a.role, accountEmail(tenant, a.local), a.name[tenant]);
    }
  }
  ctx.log(`members: ${ROLE_ACCOUNTS.length} per tenant`);

  const adminId = await ensureUser(ctx, PLATFORM_ADMIN_EMAIL, "Platform Admin");
  await ctx.sql`insert into public.platform_admins (user_id) values (${adminId}) on conflict do nothing`;
  ctx.log(`platform admin: ${PLATFORM_ADMIN_EMAIL} (${sid(`user:${PLATFORM_ADMIN_EMAIL}`)})`);
}
