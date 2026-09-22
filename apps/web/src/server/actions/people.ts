"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import {
  consentSchema, householdMemberSchema, householdUpdateSchema, medicalSchema, newHouseholdSchema, noteSchema, pinSchema,
  splitList, statusChangeSchema, tagsSchema, updatePersonSchema, newMemberSchema, type NewHouseholdInput, type NewMemberInput, type NoteInput, type UpdatePersonInput,
} from "@/lib/validation/people";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";
import { logger } from "../log";

/** F3.1: household + guardians + students (+ minors' consents) in one atomic RPC. */
export async function createHousehold(input: NewHouseholdInput): Promise<ActionResult<{ householdId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = newHouseholdSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const members = [
    ...v.guardians.map((g) => ({
      relationship: "guardian",
      first_name: g.firstName,
      last_name: g.lastName,
      email: g.email || null,
      phone: g.phone || null,
      email_consent: g.emailConsent,
      sms_consent: g.smsConsent,
    })),
    ...v.students.map((s) => ({
      relationship: "student",
      first_name: s.firstName,
      last_name: s.lastName,
      dob: s.dob || null,
      allergies: splitList(s.allergies),
      status: s.status,
      consents: s.consents,
    })),
  ];
  const { data, error } = await ctx.supabase.rpc("create_household", { p: { name: v.householdName, members } });
  if (error || !data) {
    logger(ctx).error({ err: error?.message }, "create_household failed");
    return fail("Couldn't save the household. Please try again.");
  }
  revalidatePath("/desk/people");
  redirect(`/desk/households/${data}`);
}

export async function updatePerson(input: UpdatePersonInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = updatePersonSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const { error } = await ctx.supabase
    .from("people")
    .update({
      first_name: v.firstName,
      last_name: v.lastName,
      preferred_name: v.preferredName || null,
      dob: v.dob || null,
      email: v.email || null,
      phone: v.phone || null,
      email_consent: v.emailConsent,
      phone_sms_consent: v.smsConsent,
      allergies: splitList(v.allergies),
      injury_flags: splitList(v.injuryFlags),
      uniform_size: v.uniformSize || null,
      belt_size: v.beltSize || null,
    })
    .eq("id", v.id);
  if (error) return fail("Couldn't save changes.");
  revalidatePath(`/desk/people/${v.id}`);
  return ok();
}

export async function changeStatus(input: { id: string; status: string; reason?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid status");
  const { error } = await ctx.supabase.from("people").update({ status: parsed.data.status, status_reason: parsed.data.reason || null }).eq("id", parsed.data.id);
  if (error) return fail("Couldn't change status.");
  revalidatePath(`/desk/people/${parsed.data.id}`);
  return ok();
}

export async function setMedicalNotes(input: { personId: string; notes: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: ["people.medical.read", "people.write"] });
  if (denied) return denied;
  const parsed = medicalSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input");
  const { error } = await ctx.supabase
    .from("people_medical")
    .upsert({ tenant_id: ctx.tenantId as string, person_id: parsed.data.personId, medical_notes: parsed.data.notes, updated_by: ctx.userId }, { onConflict: "person_id" });
  if (error) return fail("Couldn't save medical notes.");
  revalidatePath(`/desk/people/${parsed.data.personId}`);
  return ok();
}

export async function addNote(input: NoteInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.read" });
  if (denied) return denied;
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const { error } = await ctx.supabase.from("notes").insert({
    tenant_id: ctx.tenantId as string,
    person_id: parsed.data.personId,
    kind: parsed.data.kind,
    body: parsed.data.body,
    by_user_id: ctx.userId,
  });
  if (error) return fail("You don't have permission to add notes.");
  revalidatePath(`/desk/people/${parsed.data.personId}`);
  return ok();
}

/** Bulk-tag people (from the list selection). */
export async function addTag(input: { personIds: string[]; tag: string }): Promise<ActionResult<{ updated: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = tagsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid tag");
  const { data: rows, error } = await ctx.supabase.from("people").select("id, tags").in("id", parsed.data.personIds);
  if (error) return fail("Couldn't load the selected people.");
  let updated = 0;
  for (const r of rows ?? []) {
    if (r.tags.includes(parsed.data.tag)) continue;
    const { error: e } = await ctx.supabase.from("people").update({ tags: [...r.tags, parsed.data.tag] }).eq("id", r.id);
    if (!e) updated++;
  }
  revalidatePath("/desk/people");
  return ok({ updated });
}

export async function removeTag(input: { personId: string; tag: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const { data: row } = await ctx.supabase.from("people").select("tags").eq("id", input.personId).maybeSingle();
  if (!row) return fail("Person not found");
  const { error } = await ctx.supabase.from("people").update({ tags: row.tags.filter((t) => t !== input.tag) }).eq("id", input.personId);
  if (error) return fail("Couldn't remove the tag.");
  revalidatePath(`/desk/people/${input.personId}`);
  return ok();
}

export async function recordConsent(input: { personId: string; kind: string; granted: boolean }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid consent");
  const { error } = await ctx.supabase.from("consents").insert({
    tenant_id: ctx.tenantId as string,
    person_id: parsed.data.personId,
    kind: parsed.data.kind,
    granted: parsed.data.granted,
    method: "desk",
    recorded_by: ctx.userId,
  });
  if (error) return fail("Couldn't record consent.");
  revalidatePath(`/desk/people/${parsed.data.personId}`);
  return ok();
}

export async function updateHousehold(input: { id: string; name: string; billingEmail?: string; notes?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = householdUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const { error } = await ctx.supabase
    .from("households")
    .update({ name: parsed.data.name, billing_email: parsed.data.billingEmail || null, notes: parsed.data.notes || null })
    .eq("id", parsed.data.id);
  if (error) return fail("Couldn't save the household.");
  revalidatePath(`/desk/households/${parsed.data.id}`);
  return ok();
}

export async function addHouseholdMember(input: { householdId: string; personId: string; relationship: "guardian" | "student" | "other" }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = householdMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid member");
  const { error } = await ctx.supabase.from("household_members").insert({
    tenant_id: ctx.tenantId as string,
    household_id: parsed.data.householdId,
    person_id: parsed.data.personId,
    relationship: parsed.data.relationship,
    can_pickup: parsed.data.relationship === "guardian",
  });
  if (error) return fail(error.code === "23505" ? "Already in this household." : "Couldn't add to the household.");
  revalidatePath(`/desk/households/${parsed.data.householdId}`);
  return ok();
}

export async function removeHouseholdMember(input: { householdId: string; personId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const { error } = await ctx.supabase.from("household_members").delete().eq("household_id", input.householdId).eq("person_id", input.personId);
  if (error) return fail("Couldn't remove from the household.");
  revalidatePath(`/desk/households/${input.householdId}`);
  return ok();
}

export async function setPrimaryPayer(input: { householdId: string; personId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const { error } = await ctx.supabase.from("households").update({ primary_payer_person_id: input.personId }).eq("id", input.householdId);
  if (error) return fail("Couldn't set the payer.");
  await ctx.supabase.from("household_members").update({ receives_billing: false, is_primary_guardian: false }).eq("household_id", input.householdId);
  await ctx.supabase.from("household_members").update({ receives_billing: true, is_primary_guardian: true }).eq("household_id", input.householdId).eq("person_id", input.personId);
  revalidatePath(`/desk/households/${input.householdId}`);
  return ok();
}

export async function setHouseholdPin(input: { householdId: string; pin: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return fail("PIN must be 4 digits", { pin: "4 digits" });
  const { error } = await ctx.supabase.rpc("set_household_pin", { p_household_id: parsed.data.householdId, p_pin: parsed.data.pin });
  if (error) return fail("Couldn't set the PIN.");
  revalidatePath(`/desk/households/${parsed.data.householdId}`);
  return ok();
}

/** Person search for pickers (add to household, walk-ins). */
export async function searchPeople(q: string): Promise<ActionResult<{ id: string; name: string; status: string; households: string[] }[]>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.read" });
  if (denied) return denied;
  const term = q.trim().toLowerCase();
  if (term.length < 2) return ok([]);
  const { data, error } = await ctx.supabase
    .from("v_people_search")
    .select("id, display_name, status, household_names")
    .ilike("search_text", `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
    .order("last_name")
    .limit(20);
  if (error) return fail("Search failed");
  return ok((data ?? []).map((r) => ({ id: r.id as string, name: r.display_name ?? "", status: r.status ?? "", households: r.household_names ?? [] })));
}

export async function addNewHouseholdMember(input: NewMemberInput): Promise<ActionResult<{ personId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = newMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const { data, error } = await ctx.supabase.rpc("add_household_person", {
    p_household_id: v.householdId,
    m: { relationship: v.relationship, first_name: v.firstName, last_name: v.lastName, dob: v.dob || null, email: v.email || null, phone: v.phone || null },
  });
  if (error || !data) return fail("Couldn't add the person.");
  revalidatePath(`/desk/households/${v.householdId}`);
  return ok({ personId: data });
}
