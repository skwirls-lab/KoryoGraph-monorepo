"use server";

import { DbError, rpc } from "@koryo/db";
import type { Json } from "@koryo/db/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { automationSchema, type AutomationInput } from "@/lib/automations";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

export async function saveAutomation(input: AutomationInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "automations.manage", module: "grow" });
  if (denied) return denied;
  const parsed = automationSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the automation", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const row = { name: v.name, description: v.description, trigger: v.trigger as Json, conditions: v.conditions as Json, actions: v.actions as Json, active: v.active };
  if (v.id) {
    const { error } = await ctx.supabase.from("automations").update(row).eq("id", v.id);
    if (error) return fail("Couldn't save the automation.");
    revalidatePath("/desk/automations", "layout");
    return ok({ id: v.id });
  }
  const { data, error } = await ctx.supabase.from("automations").insert({ ...row, tenant_id: ctx.tenantId as string }).select("id").single();
  if (error || !data) return fail("Couldn't create the automation.");
  revalidatePath("/desk/automations", "layout");
  return ok({ id: data.id });
}

export async function setAutomationActive(input: { id: string; active: boolean }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "automations.manage", module: "grow" });
  if (denied) return denied;
  if (!z.uuid().safeParse(input.id).success) return fail("Invalid automation.");
  const { error } = await ctx.supabase.from("automations").update({ active: input.active }).eq("id", input.id);
  if (error) return fail("Couldn't change the automation.");
  revalidatePath("/desk/automations", "layout");
  return ok();
}


const segmentSchema = z.object({
  program_ids: z.array(z.uuid()).default([]),
  statuses: z.array(z.string()).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  age_min: z.union([z.number().int().min(0).max(120), z.literal("")]).default(""),
  age_max: z.union([z.number().int().min(0).max(120), z.literal("")]).default(""),
});

export async function previewSegment(input: { segment: z.input<typeof segmentSchema>; channel: "email" | "sms" }): Promise<ActionResult<{ people: number; recipients: number; no_consent: number; no_address: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "comms.send", module: "grow" });
  if (denied) return denied;
  const parsed = segmentSchema.safeParse(input.segment);
  if (!parsed.success || !["email", "sms"].includes(input.channel)) return fail("Check the segment.");
  try {
    return ok((await rpc(ctx.supabase, "segment_preview", { p_definition: parsed.data as Json, p_channel: input.channel })) as { people: number; recipients: number; no_consent: number; no_address: number });
  } catch {
    return fail("Couldn't count the segment.");
  }
}

const broadcastSchema = z.object({
  name: z.string().trim().min(2, { error: "Name the broadcast" }).max(120),
  channel: z.enum(["email", "sms"]),
  subject: z.string().trim().max(200).default(""),
  body: z.string().trim().min(2, { error: "Write the message" }).max(5000),
  segment: segmentSchema,
});

/** Save and send now: one message per consented recipient in the segment (delivered by the Outbox). */
export async function sendBroadcast(input: z.input<typeof broadcastSchema>): Promise<ActionResult<{ id: string; queued: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "comms.send", module: "grow" });
  if (denied) return denied;
  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the broadcast", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (v.channel === "email" && v.subject.length < 2) return fail("Add a subject line.", { subject: "Add a subject line" });
  if (v.channel === "sms" && v.body.length > 480) return fail("Keep texts under 480 characters.", { body: "Too long for SMS" });
  const { data: c, error } = await ctx.supabase.from("campaigns").insert({
    tenant_id: ctx.tenantId as string, name: v.name, channel: v.channel, subject: v.channel === "email" ? v.subject : null, body: v.body, segment: v.segment as Json, created_by: ctx.userId,
  }).select("id").single();
  if (error || !c) return fail("Couldn't save the broadcast.");
  try {
    const queued = (await rpc(ctx.supabase, "send_broadcast", { p_campaign_id: c.id })) as number;
    // Deliver right away rather than waiting for the next scheduled dispatch.
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
    await fetch(`${base}/api/jobs/outbox_dispatch?tenant=${ctx.tenantId}`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } }).catch(() => undefined);
    revalidatePath("/desk/broadcasts", "layout");
    return ok({ id: c.id, queued });
  } catch (err) {
    return fail(err instanceof DbError ? err.message : "Couldn't send the broadcast.");
  }
}
