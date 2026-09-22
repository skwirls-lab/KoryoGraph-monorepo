import "server-only";
import { forbidden, redirect } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import type { ServerClient } from "@koryo/db/server";
import { landingSurface, type Surface } from "@/lib/surfaces";
import { supabaseServer } from "./supabase";

const appMetadata = z
  .object({
    tenant_id: z.uuid().optional(),
    role: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    modules: z.array(z.string()).optional(),
    platform_admin: z.boolean().optional(),
  })
  .loose();

export interface Ctx {
  userId: string;
  email: string | null;
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
  permissions: ReadonlySet<string>;
  modules: ReadonlySet<string>;
  platformAdmin: boolean;
  /** Tenant timezone (IANA); UTC when no tenant. */
  tz: string;
  currency: string;
  requestId: string | null;
  supabase: ServerClient;
}

export class AuthzError extends Error {
  override name = "AuthzError";
  constructor(
    readonly status: 401 | 403,
    message: string,
    readonly code: "unauthenticated" | "no_tenant" | "forbidden" | "module_locked" = status === 401 ? "unauthenticated" : "forbidden",
  ) {
    super(message);
  }
}

/**
 * The verified request context, or null when signed out. Claims come from `auth.getClaims()`, which
 * verifies the JWT (signature via JWKS, or a `getUser()` round-trip for symmetric keys) — never from
 * an unverified cookie read. Cached per request.
 */
export const getOptionalCtx = cache(async (): Promise<Ctx | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  const meta = appMetadata.parse(claims.app_metadata ?? {});
  const tenantId = meta.tenant_id ?? null;

  let tenantName: string | null = null;
  let tz = "UTC";
  let currency = "USD";
  if (tenantId) {
    const { data: t } = await supabase.from("tenants").select("name, timezone, currency").eq("id", tenantId).maybeSingle();
    if (t) {
      tenantName = t.name;
      tz = t.timezone;
      currency = t.currency;
    }
  }

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    tenantId,
    tenantName,
    role: meta.role ?? null,
    permissions: new Set(meta.permissions ?? []),
    modules: new Set(meta.modules ?? []),
    platformAdmin: meta.platform_admin === true,
    tz,
    currency,
    requestId: (await headers()).get("x-request-id"),
    supabase,
  };
});

/** For server actions and route handlers: throws AuthzError(401) when signed out. */
export async function getCtx(): Promise<Ctx> {
  const ctx = await getOptionalCtx();
  if (!ctx) throw new AuthzError(401, "Not signed in");
  return ctx;
}

export function requireTenant(ctx: Ctx): asserts ctx is Ctx & { tenantId: string } {
  if (!ctx.tenantId) throw new AuthzError(403, "No school selected", "no_tenant");
}

export function requirePermission(ctx: Ctx, permission: string): void {
  requireTenant(ctx);
  if (!ctx.permissions.has(permission)) throw new AuthzError(403, `Missing permission ${permission}`);
}

export function requireModule(ctx: Ctx, module: string): void {
  requireTenant(ctx);
  if (!ctx.modules.has(module)) throw new AuthzError(403, `The ${module} module is not enabled for this school`, "module_locked");
}

export function requireSurface(ctx: Ctx, surface: Surface): void {
  requirePermission(ctx, `${surface}.access`);
}

export function hasPermission(ctx: Ctx, permission: string): boolean {
  return ctx.permissions.has(permission);
}

/** Where a signed-in user belongs. */
export function landingPath(ctx: Ctx): string {
  if (!ctx.tenantId) return "/welcome";
  const s = landingSurface([...ctx.permissions]);
  return s ? `/${s}` : "/welcome";
}

/**
 * For surface layouts/pages: signed out → /login, no tenant → /welcome, lacking `<surface>.access` →
 * the 403 page. Returns the context.
 */
export async function requireSurfacePage(surface: Surface): Promise<Ctx & { tenantId: string }> {
  const ctx = await getOptionalCtx();
  if (!ctx) redirect(`/login?next=/${surface}`);
  if (!ctx.tenantId) redirect("/welcome");
  if (!ctx.permissions.has(`${surface}.access`)) forbidden();
  return ctx as Ctx & { tenantId: string };
}
