"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

export async function markNotificationsRead(): Promise<ActionResult<{ marked: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "home.access" });
  if (denied) return denied;
  const { data, error } = await ctx.supabase.rpc("mark_notifications_read", {});
  if (error) return fail("Couldn't update notifications.");
  revalidatePath("/home", "layout");
  return ok({ marked: data ?? 0 });
}

const subSchema = z.object({ endpoint: z.url().startsWith("https://").max(1000), keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }) });

/** Save this browser's push subscription (only offered when the server has VAPID keys). */
export async function savePushSubscription(input: z.input<typeof subSchema> & { userAgent?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "home.access" });
  if (denied) return denied;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return fail("Push notifications aren't set up on this server.");
  const v = subSchema.safeParse(input);
  if (!v.success) return fail("That subscription isn't valid.");
  const { error } = await ctx.supabase.from("push_subscriptions").upsert({
    tenant_id: ctx.tenantId as string, user_id: ctx.userId, endpoint: v.data.endpoint, p256dh: v.data.keys.p256dh, auth: v.data.keys.auth, user_agent: input.userAgent?.slice(0, 200) ?? null,
  }, { onConflict: "endpoint" });
  if (error) return fail("Couldn't save the subscription.");
  return ok();
}

export async function removePushSubscription(input: { endpoint: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "home.access" });
  if (denied) return denied;
  const { error } = await ctx.supabase.from("push_subscriptions").delete().eq("endpoint", input.endpoint);
  if (error) return fail("Couldn't turn off push.");
  return ok();
}
