"use server";

import { DbError, rpc } from "@koryo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { newLeadSchema, type NewLeadInput } from "@/lib/validation/crm";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const need = { permission: "crm.manage", module: "grow" } as const;
const uuid = z.uuid();
const dbMessage = (err: unknown, fallback: string) => (err instanceof DbError && ["22023", "P0002"].includes(err.code ?? "") ? err.message.charAt(0).toUpperCase() + err.message.slice(1) + "." : fallback);
const revalidate = (leadId?: string) => {
  revalidatePath("/desk/crm");
  if (leadId) revalidatePath(`/desk/crm/leads/${leadId}`);
};

/** Desk manual add. Duplicates (same email or phone) join the existing person and open lead. */
export async function createLead(input: NewLeadInput): Promise<ActionResult<{ id: string; merged: boolean }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = newLeadSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const digits = v.phone.replace(/\D/g, "");
  const { data: matches } = await ctx.supabase.from("people").select("id, email, phone").is("archived_at", null)
    .or([v.email ? `email.ilike.${v.email.replace(/[%_,()]/g, "")}` : "", digits.length >= 7 ? `phone.ilike.%${digits.slice(-7)}%` : ""].filter(Boolean).join(","));
  const existing = (matches ?? []).find((m) => (v.email && m.email?.toLowerCase() === v.email.toLowerCase()) || (digits && (m.phone ?? "").replace(/\D/g, "") === digits));
  let personId = existing?.id;
  if (!personId) {
    const { data: p, error } = await ctx.supabase.from("people").insert({
      tenant_id: ctx.tenantId as string, first_name: v.firstName, last_name: v.lastName, email: v.email || null, phone: v.phone || null,
      type_flags: ["lead"], status: "lead", source: v.source, email_consent: Boolean(v.email),
    }).select("id").single();
    if (error || !p) return fail("Couldn't save the lead.");
    personId = p.id;
  }
  const { data: open } = await ctx.supabase.from("leads").select("id").eq("person_id", personId).is("converted_household_id", null).is("lost_reason", null).maybeSingle();
  if (open) {
    await ctx.supabase.from("lead_activities").insert({ tenant_id: ctx.tenantId as string, lead_id: open.id, kind: "note", body: v.note || "Added again from the Desk (duplicate merged)", by_user_id: ctx.userId });
    revalidate(open.id);
    return ok({ id: open.id, merged: true });
  }
  const { data: stage } = await ctx.supabase.from("pipeline_stages").select("id").eq("key", "new").single();
  const { data: lead, error } = await ctx.supabase.from("leads").insert({
    tenant_id: ctx.tenantId as string, person_id: personId, stage_id: stage?.id ?? "", program_interest: v.programIds, source: v.source, owner_user_id: ctx.userId, message: v.note || null,
  }).select("id").single();
  if (error || !lead) return fail("Couldn't save the lead.");
  if (v.note) await ctx.supabase.from("lead_activities").insert({ tenant_id: ctx.tenantId as string, lead_id: lead.id, kind: "note", body: v.note, by_user_id: ctx.userId });
  revalidate();
  return ok({ id: lead.id, merged: Boolean(existing) });
}

/** Move a card. trial_scheduled needs a booked class (use bookTrial); lost needs a reason; won happens on enrollment. */
export async function moveLead(input: { leadId: string; stageId: string; lostReason?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  if (!uuid.safeParse(input.leadId).success || !uuid.safeParse(input.stageId).success) return fail("Invalid request.");
  const [{ data: lead }, { data: stage }] = await Promise.all([
    ctx.supabase.from("leads").select("id, stage_id, trial_booking_id").eq("id", input.leadId).maybeSingle(),
    ctx.supabase.from("pipeline_stages").select("id, key, name, kind").eq("id", input.stageId).maybeSingle(),
  ]);
  if (!lead || !stage) return fail("Lead or stage not found.");
  if (lead.stage_id === stage.id) return ok();
  if (stage.key === "trial_scheduled" && !lead.trial_booking_id) return fail("Book a trial class to move this lead to Trial scheduled.");
  if (stage.kind === "won") return fail("Leads are won by enrolling them — use Convert.");
  const lostReason = (input.lostReason ?? "").trim();
  if (stage.kind === "lost" && lostReason.length < 2) return fail("Say why this lead was lost.");
  const { error } = await ctx.supabase.from("leads").update({ stage_id: stage.id, stage_changed_at: new Date().toISOString(), lost_reason: stage.kind === "lost" ? lostReason : null }).eq("id", lead.id);
  if (error) return fail("Couldn't move the lead.");
  await ctx.supabase.from("lead_activities").insert({ tenant_id: ctx.tenantId as string, lead_id: lead.id, kind: "stage_change", body: `Moved to ${stage.name}${stage.kind === "lost" ? `: ${lostReason}` : ""}`, by_user_id: ctx.userId });
  revalidate(lead.id);
  return ok();
}

export async function bookTrial(input: { leadId: string; sessionId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  if (!uuid.safeParse(input.leadId).success || !uuid.safeParse(input.sessionId).success) return fail("Choose a class.");
  try {
    await rpc(ctx.supabase, "book_lead_trial", { p_lead_id: input.leadId, p_session_id: input.sessionId });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't book the class."));
  }
  revalidate(input.leadId);
  return ok();
}

const activitySchema = z.object({ leadId: z.uuid(), kind: z.enum(["note", "call", "email", "sms"]), body: z.string().trim().min(2, { error: "Write something" }).max(4000) });

export async function addLeadActivity(input: z.input<typeof activitySchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the note");
  const { error } = await ctx.supabase.from("lead_activities").insert({ tenant_id: ctx.tenantId as string, lead_id: parsed.data.leadId, kind: parsed.data.kind, body: parsed.data.body, by_user_id: ctx.userId });
  if (error) return fail("Couldn't save.");
  revalidate(parsed.data.leadId);
  return ok();
}

export async function setNextAction(input: { leadId: string; text: string; at: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({ leadId: z.uuid(), text: z.string().trim().max(200), at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")) }).safeParse(input);
  if (!parsed.success) return fail("Check the next action.");
  const v = parsed.data;
  const { error } = await ctx.supabase.from("leads").update({ next_action: v.text || null, next_action_at: v.at ? `${v.at}T14:00:00Z` : null }).eq("id", v.leadId);
  if (error) return fail("Couldn't save.");
  if (v.text && v.at) {
    const { data: l } = await ctx.supabase.from("leads").select("person_id").eq("id", v.leadId).single();
    await ctx.supabase.from("tasks").insert({ tenant_id: ctx.tenantId as string, lead_id: v.leadId, person_id: l?.person_id ?? null, title: v.text, due_at: `${v.at}T14:00:00Z`, assignee_user_id: ctx.userId, created_by: ctx.userId });
  }
  revalidate(v.leadId);
  return ok();
}

/**
 * Convert: make sure the lead has a household (created with them as the student and payer if needed),
 * then continue in the enrollment wizard; enrolling marks the lead won (database trigger).
 */
export async function convertLead(leadId: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: ["crm.manage", "people.write", "billing.charge"], module: "grow" });
  if (denied) return denied;
  if (!uuid.safeParse(leadId).success) return fail("Invalid lead.");
  const { data: lead } = await ctx.supabase.from("leads").select("id, person_id, people(first_name, last_name, email, type_flags)").eq("id", leadId).maybeSingle();
  if (!lead?.people) return fail("Lead not found.");
  const { data: member } = await ctx.supabase.from("household_members").select("household_id").eq("person_id", lead.person_id).limit(1).maybeSingle();
  if (!member) {
    const { data: hh, error } = await ctx.supabase.from("households").insert({
      tenant_id: ctx.tenantId as string, name: `${lead.people.last_name || lead.people.first_name} family`, primary_payer_person_id: lead.person_id, billing_email: lead.people.email,
    }).select("id").single();
    if (error || !hh) return fail("Couldn't create the household.");
    await ctx.supabase.from("household_members").insert({ tenant_id: ctx.tenantId as string, household_id: hh.id, person_id: lead.person_id, relationship: "student", is_primary_guardian: true });
  }
  const flags = [...new Set([...(lead.people.type_flags ?? []).filter((f) => f !== "lead"), "student"])];
  await ctx.supabase.from("people").update({ type_flags: flags }).eq("id", lead.person_id);
  return ok({ url: `/desk/people/${lead.person_id}/enroll` });
}

export async function saveStage(input: { id?: string; name: string; position: number }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({ id: z.uuid().optional(), name: z.string().trim().min(2).max(40), position: z.number().int().min(0).max(10_000) }).safeParse(input);
  if (!parsed.success) return fail("Name the stage (2–40 characters).");
  const v = parsed.data;
  const { error } = v.id
    ? await ctx.supabase.from("pipeline_stages").update({ name: v.name, position: v.position }).eq("id", v.id)
    : await ctx.supabase.from("pipeline_stages").insert({ tenant_id: ctx.tenantId as string, name: v.name, position: v.position, kind: "open" });
  if (error) return fail("Couldn't save the stage.");
  revalidatePath("/desk/crm", "layout");
  return ok();
}
