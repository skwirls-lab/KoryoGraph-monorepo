import "server-only";
import { cookies } from "next/headers";
import type { Ctx } from "../context";

export const LOCATION_COOKIE = "kg-location";

/** Locations this user may work in (their assignment, or all) and the one picked in the switcher (null = all). */
export async function locationScope(ctx: Ctx): Promise<{ locations: { id: string; name: string }[]; selected: string | null; multi: boolean }> {
  const [{ data: all }, { data: me }] = await Promise.all([
    ctx.supabase.from("locations").select("id, name, is_default").is("archived_at", null).order("is_default", { ascending: false }).order("name"),
    ctx.supabase.from("tenant_users").select("location_ids").eq("user_id", ctx.userId).eq("tenant_id", ctx.tenantId as string).maybeSingle(),
  ]);
  const allowed = me?.location_ids?.length ? new Set(me.location_ids) : null;
  const locations = (all ?? []).filter((l) => !allowed || allowed.has(l.id)).map((l) => ({ id: l.id, name: l.name }));
  const picked = (await cookies()).get(LOCATION_COOKIE)?.value ?? null;
  const selected = locations.length === 1 ? (locations[0]?.id ?? null) : locations.some((l) => l.id === picked) ? picked : null;
  return { locations, selected, multi: ctx.modules.has("multi_location") && locations.length > 1 };
}
