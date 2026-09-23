"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";
import { LOCATION_COOKIE } from "../queries/locations";

/** The location switcher (per browser); RLS still limits what a location-restricted user can see. */
export async function setCurrentLocation(input: { id: string | null }): Promise<ActionResult> {
  const ctx = await getCtx();
  // Staff on either the Desk or the Mat.
  const denied = ctx.permissions.has("mat.access") ? null : authorize(ctx, { permission: "desk.access" });
  if (denied) return denied;
  const jar = await cookies();
  if (input.id && z.uuid().safeParse(input.id).success) jar.set(LOCATION_COOKIE, input.id, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  else jar.delete(LOCATION_COOKIE);
  revalidatePath("/", "layout");
  return ok();
}

const newLocation = z.object({
  name: z.string().trim().min(2, { error: "Name the location" }).max(80),
  line1: z.string().trim().min(3, { error: "Enter the street address" }).max(120),
  city: z.string().trim().min(2, { error: "Enter the city" }).max(80),
  region: z.string().trim().max(60).optional(),
  postalCode: z.string().trim().min(3, { error: "Enter the postal code" }).max(20),
});

/** Another location (Multi-location module). */
export async function addLocation(input: z.input<typeof newLocation>): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage", module: "multi_location" });
  if (denied) return denied;
  const v = newLocation.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Check the address");
  const { data: main } = await ctx.supabase.from("locations").select("address").eq("is_default", true).maybeSingle();
  const country = ((main?.address ?? {}) as { country?: string }).country ?? "US";
  const { data, error } = await ctx.supabase.from("locations").insert({
    tenant_id: ctx.tenantId as string, name: v.data.name, timezone: ctx.tz,
    address: { line1: v.data.line1, city: v.data.city, region: v.data.region || undefined, postal_code: v.data.postalCode, country },
  }).select("id").single();
  if (error || !data) return fail("Couldn't add the location.");
  revalidatePath("/desk/settings/location");
  return ok({ id: data.id });
}

/** Limit a staff member to some locations (empty = all). */
export async function setStaffLocations(input: { userId: string; locationIds: string[] }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "staff.manage", module: "multi_location" });
  if (denied) return denied;
  const v = z.object({ userId: z.uuid(), locationIds: z.array(z.uuid()).max(50) }).safeParse(input);
  if (!v.success) return fail("Invalid locations.");
  const { error } = await ctx.supabase.rpc("set_staff_locations", { p_user_id: v.data.userId, p_location_ids: v.data.locationIds });
  if (error) return fail(error.message.includes("owners") ? "Owners always see every location." : "Couldn't save the locations.");
  revalidatePath(`/desk/staff/${v.data.userId}`);
  return ok();
}
