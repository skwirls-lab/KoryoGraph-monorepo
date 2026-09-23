import "server-only";
import type { Ctx } from "../context";

export interface ShellData {
  user: { name: string; email: string | null; role: string | null };
  tenants: { id: string; name: string }[];
  /** The school's logo (signed URL, 1 h) when it has uploaded one. */
  logoUrl: string | null;
}

/** Data every surface chrome needs: display name and the schools this user can switch between. */
export async function loadShellData(ctx: Ctx): Promise<ShellData> {
  const [profile, memberships, tenant] = await Promise.all([
    ctx.supabase.from("profiles").select("full_name, email").eq("id", ctx.userId).maybeSingle(),
    ctx.supabase.from("tenant_users").select("tenant_id, tenants(name)").eq("user_id", ctx.userId).eq("status", "active"),
    ctx.tenantId ? ctx.supabase.from("tenants").select("branding").eq("id", ctx.tenantId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const logoPath = ((tenant.data?.branding ?? {}) as { logo_path?: string | null }).logo_path;
  const logoUrl = logoPath ? (await ctx.supabase.storage.from("tenant-media").createSignedUrl(logoPath, 3600)).data?.signedUrl ?? null : null;
  const tenants = (memberships.data ?? [])
    .map((m) => ({ id: m.tenant_id, name: m.tenants?.name ?? "School" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    user: {
      name: profile.data?.full_name ?? profile.data?.email ?? ctx.email ?? "Account",
      email: profile.data?.email ?? ctx.email,
      role: ctx.role,
    },
    tenants,
    logoUrl,
  };
}
