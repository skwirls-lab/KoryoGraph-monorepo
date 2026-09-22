"use server";

import { SYSTEM_TEMPLATES, render, textToHtml } from "@koryo/comms";
import { providersFromEnv } from "@koryo/comms/providers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { notify } from "../comms";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const bodySchema = z.string().trim().min(1, { error: "Write a message" }).max(5000);

/** Staff reply in a household thread; guardians get an email notice (or it lands in the Outbox). */
export async function replyToThread(input: { threadId: string; body: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "comms.send" });
  if (denied) return denied;
  const parsed = z.object({ threadId: z.uuid(), body: bodySchema }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid message");
  const { data: thread } = await ctx.supabase.from("message_threads").select("id, household_id").eq("id", parsed.data.threadId).maybeSingle();
  if (!thread) return fail("Conversation not found");
  const { error } = await ctx.supabase.from("thread_messages").insert({
    tenant_id: ctx.tenantId as string, thread_id: thread.id, sender_user_id: ctx.userId, from_staff: true, body: parsed.data.body,
  });
  if (error) return fail("Couldn't send the reply.");
  await ctx.supabase.rpc("mark_thread_read", { p_thread_id: thread.id });
  const { data: guardians } = await ctx.supabase.from("household_members").select("person_id").eq("household_id", thread.household_id).eq("relationship", "guardian");
  if (guardians?.length) {
    await notify(ctx, {
      personIds: guardians.map((g) => g.person_id), templateKey: "thread_message", channels: ["email"],
      data: { preview: parsed.data.body.slice(0, 280) }, related: { type: "message_thread", id: thread.id },
    });
  }
  revalidatePath(`/desk/inbox/${thread.id}`);
  revalidatePath("/desk/inbox");
  return ok();
}

export async function assignThread(input: { threadId: string; userId: string | null }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "comms.send" });
  if (denied) return denied;
  const parsed = z.object({ threadId: z.uuid(), userId: z.uuid().nullable() }).safeParse(input);
  if (!parsed.success) return fail("Invalid assignment");
  const { error } = await ctx.supabase.from("message_threads").update({ assigned_user_id: parsed.data.userId }).eq("id", parsed.data.threadId);
  if (error) return fail("Couldn't assign the conversation.");
  revalidatePath(`/desk/inbox/${parsed.data.threadId}`);
  return ok();
}

export async function setThreadStatus(input: { threadId: string; status: "open" | "closed" }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "comms.send" });
  if (denied) return denied;
  const parsed = z.object({ threadId: z.uuid(), status: z.enum(["open", "closed"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid status");
  const { error } = await ctx.supabase.from("message_threads").update({ status: parsed.data.status }).eq("id", parsed.data.threadId);
  if (error) return fail("Couldn't update the conversation.");
  revalidatePath("/desk/inbox", "layout");
  return ok();
}

/** Instructor/staff broadcast to the families on a class roster (email + SMS, consent enforced). */
export async function messageClass(input: { sessionId: string; message: string }): Promise<ActionResult<Record<string, number>>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "comms.send" });
  if (denied) return denied;
  const parsed = z.object({ sessionId: z.uuid(), message: bodySchema }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid message");
  const [{ data: s }, { data: roster }, { data: me }] = await Promise.all([
    ctx.supabase.from("class_sessions").select("id, name").eq("id", parsed.data.sessionId).maybeSingle(),
    ctx.supabase.from("v_class_roster").select("person_id, booking_status").eq("session_id", parsed.data.sessionId),
    ctx.supabase.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle(),
  ]);
  if (!s) return fail("Class not found");
  const people = [...new Set((roster ?? []).filter((r) => r.booking_status !== "cancelled").map((r) => r.person_id as string))];
  if (people.length === 0) return fail("No one is on this roster yet.");
  const summary = await notify(ctx, {
    personIds: people, templateKey: "class_broadcast",
    data: { class_name: s.name, message: parsed.data.message, sender_name: me?.full_name ?? "Your instructor" },
    related: { type: "class_session", id: s.id },
  });
  return ok(summary.byStatus);
}

/** Retry an unsent/failed message now (e.g. after a provider key was added). */
export async function resendCommunication(input: { id: string }): Promise<ActionResult<{ status: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "comms.send" });
  if (denied) return denied;
  const { data: c } = await ctx.supabase.from("communications").select("*").eq("id", input.id).maybeSingle();
  if (!c) return fail("Message not found");
  if (!["unsent_no_provider", "failed"].includes(c.status)) return fail("Only unsent or failed messages can be resent.");
  const providers = providersFromEnv(process.env);
  const p = c.channel === "email" ? providers.email : c.channel === "sms" ? providers.sms : null;
  if (!p) return fail(`No ${c.channel === "sms" ? "SMS" : "email"} provider is configured, so it can't be sent yet.`);
  let status = "sent";
  let providerMessageId: string | null = null;
  let error: string | null = null;
  try {
    const res = c.channel === "email"
      ? await providers.email!.send({ to: c.to_address ?? "", subject: c.subject ?? "", text: c.body_text, html: c.body_html ?? textToHtml(c.body_text) })
      : await providers.sms!.send({ to: c.to_address ?? "", body: c.body_text });
    providerMessageId = res.providerMessageId;
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : String(err);
  }
  const { error: recErr } = await ctx.supabase.rpc("record_communication", {
    p: {
      channel: c.channel, person_id: c.person_id, household_id: c.household_id, to_address: c.to_address, template_key: c.template_key,
      subject: c.subject, body_text: c.body_text, body_html: c.body_html, status, provider: p.name, provider_message_id: providerMessageId, error,
      related_type: c.related_type, related_id: c.related_id,
    },
  });
  if (recErr) return fail("Couldn't record the resend.");
  revalidatePath("/desk/outbox");
  return ok({ status });
}

const overrideSchema = z.object({
  key: z.string().refine((k) => k in SYSTEM_TEMPLATES, { error: "Unknown template" }),
  channel: z.enum(["email", "sms", "inapp"]),
  subject: z.string().max(200).optional().or(z.literal("")),
  body: z.string().trim().min(1, { error: "Write the message" }).max(10_000),
});

export async function saveTemplateOverride(input: z.input<typeof overrideSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "automations.manage" });
  if (denied) return denied;
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid template");
  const { missing } = render(`${parsed.data.subject ?? ""} ${parsed.data.body}`, {});
  const allowed = new Set([...(SYSTEM_TEMPLATES[parsed.data.key]?.variables ?? []), "reason_suffix"]);
  const unknown = missing.filter((m) => !allowed.has(m));
  if (unknown.length) return fail(`Unknown merge field${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{{${u}}}`).join(", ")}`);
  const { error } = await ctx.supabase.from("message_templates").upsert(
    { tenant_id: ctx.tenantId as string, key: parsed.data.key, channel: parsed.data.channel, subject: parsed.data.subject || null, body: parsed.data.body, active: true },
    { onConflict: "tenant_id,key,channel" },
  );
  if (error) return fail("Couldn't save the template.");
  revalidatePath("/desk/settings/templates");
  return ok();
}

export async function resetTemplateOverride(input: { key: string; channel: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "automations.manage" });
  if (denied) return denied;
  const { error } = await ctx.supabase.from("message_templates").delete().eq("key", input.key).eq("channel", input.channel);
  if (error) return fail("Couldn't reset the template.");
  revalidatePath("/desk/settings/templates");
  return ok();
}

// ---- Home (members) ----

/** A guardian starts a conversation with the school for their household. */
export async function startThread(input: { subject: string; body: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "home.access" });
  if (denied) return denied;
  const parsed = z.object({ subject: z.string().trim().min(2, { error: "Add a subject" }).max(120), body: bodySchema }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid message", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  const [{ data: householdIds }, { data: me }] = await Promise.all([ctx.supabase.rpc("my_household_ids"), ctx.supabase.rpc("my_person_id")]);
  const householdId = householdIds?.[0];
  if (!householdId) return fail("Your account isn't linked to a family yet — please call the school.");
  const { data: thread, error } = await ctx.supabase.from("message_threads").insert({ tenant_id: ctx.tenantId as string, household_id: householdId, subject: parsed.data.subject }).select("id").single();
  if (error || !thread) return fail("Couldn't start the conversation.");
  const { error: mErr } = await ctx.supabase.from("thread_messages").insert({
    tenant_id: ctx.tenantId as string, thread_id: thread.id, sender_user_id: ctx.userId, sender_person_id: me ?? null, from_staff: false, body: parsed.data.body,
  });
  if (mErr) return fail("Couldn't send your message.");
  redirect(`/home/messages/${thread.id}`);
}

export async function postToThread(input: { threadId: string; body: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "home.access" });
  if (denied) return denied;
  const parsed = z.object({ threadId: z.uuid(), body: bodySchema }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid message");
  const { data: me } = await ctx.supabase.rpc("my_person_id");
  const { error } = await ctx.supabase.from("thread_messages").insert({
    tenant_id: ctx.tenantId as string, thread_id: parsed.data.threadId, sender_user_id: ctx.userId, sender_person_id: me ?? null, from_staff: false, body: parsed.data.body,
  });
  if (error) return fail("Couldn't send your message.");
  await ctx.supabase.rpc("mark_thread_read", { p_thread_id: parsed.data.threadId });
  revalidatePath(`/home/messages/${parsed.data.threadId}`);
  return ok();
}

export async function markThreadRead(input: { threadId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, {});
  if (denied) return denied;
  if (!z.uuid().safeParse(input.threadId).success) return fail("Unknown conversation");
  await ctx.supabase.rpc("mark_thread_read", { p_thread_id: input.threadId });
  return ok();
}

