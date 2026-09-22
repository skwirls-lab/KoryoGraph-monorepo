"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { KIOSK_COOKIE } from "../kiosk/device";
import { authorize } from "../lib/authorize";

const pairSchema = z.object({ locationId: z.uuid(), name: z.string().trim().min(2).max(60), confirm: z.enum(["pin", "photo"]).default("pin") });

/**
 * Pair this browser as a kiosk: store the SHA-256 of a random token, put the token in a 1-year httpOnly
 * cookie, then sign the staff member out so no staff session remains on the shared device.
 */
export async function pairKiosk(input: z.input<typeof pairSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "kiosk.manage" });
  if (denied) return denied;
  const parsed = pairSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a location and name the device");
  const token = randomBytes(32).toString("base64url");
  const { error } = await ctx.supabase.from("kiosk_devices").insert({
    tenant_id: ctx.tenantId as string,
    location_id: parsed.data.locationId,
    name: parsed.data.name,
    token_hash: createHash("sha256").update(token).digest("hex"),
    paired_by: ctx.userId,
    settings: { confirm: parsed.data.confirm },
  });
  if (error) return fail("Couldn't pair this device.");
  (await cookies()).set(KIOSK_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  await ctx.supabase.auth.signOut();
  redirect("/kiosk");
}

export async function revokeKiosk(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "kiosk.manage" });
  if (denied) return denied;
  if (!z.uuid().safeParse(input.id).success) return fail("Unknown device");
  const { error } = await ctx.supabase.from("kiosk_devices").update({ revoked_at: new Date().toISOString() }).eq("id", input.id);
  if (error) return fail("Couldn't revoke the device.");
  return ok();
}
