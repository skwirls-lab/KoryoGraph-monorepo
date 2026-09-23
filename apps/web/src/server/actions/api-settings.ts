"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { API_SCOPES, WEBHOOK_EVENTS } from "@/lib/public-api";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const need = { permission: "settings.manage" } as const;
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const token = (n: number) => Array.from(randomBytes(n), (b) => ALNUM[b % ALNUM.length]).join("");

/** New API key: shown once; only its SHA-256 hash is stored. */
export async function createApiKey(input: { name: string; scopes: string[] }): Promise<ActionResult<{ key: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.object({ name: z.string().trim().min(2, { error: "Name the key (e.g. “Zapier”)" }).max(60), scopes: z.array(z.enum(API_SCOPES as [string, ...string[]])).min(1, { error: "Choose what the key can read" }) }).safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Check the key");
  const prefix = token(8);
  const key = `kg_live_${prefix}_${token(32)}`;
  const { error } = await ctx.supabase.from("api_keys").insert({
    tenant_id: ctx.tenantId as string, name: v.data.name, key_hash: createHash("sha256").update(key).digest("hex"), prefix: `kg_live_${prefix}`, scopes: v.data.scopes, created_by: ctx.userId,
  });
  if (error) return fail("Couldn't create the key.");
  revalidatePath("/desk/settings/api");
  return ok({ key });
}

export async function revokeApiKey(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.uuid().safeParse(input.id);
  if (!v.success) return fail("Invalid key.");
  const { data, error } = await ctx.supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", v.data).is("revoked_at", null).select("id");
  if (error || !data?.length) return fail("Couldn't revoke the key.");
  revalidatePath("/desk/settings/api");
  return ok();
}

/** New webhook endpoint; its signing secret is shown once. */
export async function createWebhook(input: { url: string; events: string[] }): Promise<ActionResult<{ secret: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.object({
    url: z.url({ error: "Enter the full URL (https://…)" }).max(500).refine((u) => u.startsWith("https://") || process.env.NODE_ENV !== "production", { error: "Webhook URLs must use https" }),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, { error: "Choose at least one event" }),
  }).safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Check the endpoint");
  const secret = `whsec_${token(32)}`;
  const { error } = await ctx.supabase.from("webhook_endpoints").insert({ tenant_id: ctx.tenantId as string, url: v.data.url, events: v.data.events, secret });
  if (error) return fail("Couldn't add the endpoint.");
  revalidatePath("/desk/settings/api");
  return ok({ secret });
}

export async function deleteWebhook(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.uuid().safeParse(input.id);
  if (!v.success) return fail("Invalid endpoint.");
  const { error } = await ctx.supabase.from("webhook_endpoints").delete().eq("id", v.data);
  if (error) return fail("Couldn't remove the endpoint.");
  revalidatePath("/desk/settings/api");
  return ok();
}
