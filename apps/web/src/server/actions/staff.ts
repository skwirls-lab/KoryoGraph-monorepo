"use server";

import { zonedWallTimeToUtc } from "@koryo/scheduling";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney } from "@/lib/curriculum";
import { certSchema, profileSchema, shiftSchema, timeEntrySchema, type CertInput, type ProfileInput, type ShiftInput, type TimeEntryInput } from "@/lib/validation/staff";
import { getCtx, type Ctx } from "../context";
import { authorize } from "../lib/authorize";

const manage = { permission: "staff.manage" } as const;

function at(ctx: Ctx, date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  return zonedWallTimeToUtc({ year: y, month: mo, day: d, hour: h, minute: mi }, ctx.tz).toISOString();
}

async function isStaff(ctx: Ctx, userId: string): Promise<boolean> {
  const { data } = await ctx.supabase.from("tenant_users").select("id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function saveStaffProfile(input: ProfileInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (!(await isStaff(ctx, v.userId))) return fail("Not a staff member here.");
  const pay_rates = {
    hourly_cents: v.hourly ? parseMoney(v.hourly) ?? 0 : 0,
    per_class_cents: v.perClass ? parseMoney(v.perClass) ?? 0 : 0,
    commission_pct: v.commissionPct ? Number(v.commissionPct) : 0,
  };
  const { error } = await ctx.supabase.from("staff_profiles").upsert({
    tenant_id: ctx.tenantId as string, user_id: v.userId, title: v.title || null, programs: v.programs, pay_rates, hire_date: v.hireDate || null, bio: v.bio || null,
  }, { onConflict: "tenant_id,user_id" });
  if (error) return fail("Couldn't save the profile.");
  revalidatePath(`/desk/staff/${v.userId}`);
  return ok();
}

export async function addCertification(input: CertInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  const parsed = certSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (!(await isStaff(ctx, v.userId))) return fail("Not a staff member here.");
  const { error } = await ctx.supabase.from("staff_certifications").insert({
    tenant_id: ctx.tenantId as string, user_id: v.userId, kind: v.kind, name: v.name || null, issuer: v.issuer || null, number: v.number || null,
    issued_at: v.issuedAt || null, expires_at: v.expiresAt || null,
  });
  if (error) return fail("Couldn't add the certification.");
  revalidatePath("/desk/staff", "layout");
  return ok();
}

export async function deleteCertification(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  if (!z.uuid().safeParse(input.id).success) return fail("Invalid certification");
  const { error } = await ctx.supabase.from("staff_certifications").delete().eq("id", input.id);
  if (error) return fail("Couldn't remove it.");
  revalidatePath("/desk/staff", "layout");
  return ok();
}

/** Kiosk PIN: a staff member sets their own, or staff.manage sets anyone's. */
export async function setStaffPin(input: { userId: string; pin: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const parsed = z.object({ userId: z.uuid(), pin: z.string().regex(/^\d{4}$/, { error: "The PIN is 4 digits" }) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "The PIN is 4 digits");
  if (parsed.data.userId !== ctx.userId) {
    const denied = authorize(ctx, manage);
    if (denied) return denied;
  }
  const { error } = await ctx.supabase.rpc("set_staff_pin", { p_user_id: parsed.data.userId, p_pin: parsed.data.pin });
  if (error) return fail(error.code === "42501" ? "You don't have permission to do that." : "Couldn't set the PIN.");
  revalidatePath(`/desk/staff/${parsed.data.userId}`);
  return ok();
}

/** A manual time entry (forgotten clock-in, off-site work) recorded and approved by a manager. */
export async function addTimeEntry(input: TimeEntryInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  const parsed = timeEntrySchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (!(await isStaff(ctx, v.userId))) return fail("Not a staff member here.");
  const now = new Date().toISOString();
  const { error } = await ctx.supabase.from("time_entries").insert({
    tenant_id: ctx.tenantId as string, user_id: v.userId, clock_in: at(ctx, v.date, v.clockIn), clock_out: at(ctx, v.date, v.clockOut),
    source: "desk", notes: v.notes || null, approved_by: ctx.userId, approved_at: now,
  });
  if (error) return fail("Couldn't add the time entry.");
  revalidatePath("/desk/staff", "layout");
  return ok();
}

export async function approveTimeEntry(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  if (!z.uuid().safeParse(input.id).success) return fail("Invalid entry");
  const { error } = await ctx.supabase.from("time_entries").update({ approved_by: ctx.userId, approved_at: new Date().toISOString() }).eq("id", input.id).not("clock_out", "is", null);
  if (error) return fail("Couldn't approve it.");
  revalidatePath("/desk/staff", "layout");
  return ok();
}

export async function closeTimeEntry(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  if (!z.uuid().safeParse(input.id).success) return fail("Invalid entry");
  const { error } = await ctx.supabase.from("time_entries").update({ clock_out: new Date().toISOString() }).eq("id", input.id).is("clock_out", null);
  if (error) return fail("Couldn't clock them out.");
  revalidatePath("/desk/staff", "layout");
  return ok();
}

export async function addShift(input: ShiftInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (!(await isStaff(ctx, v.userId))) return fail("Not a staff member here.");
  const { data: loc } = await ctx.supabase.from("locations").select("id").eq("is_default", true).maybeSingle();
  const { error } = await ctx.supabase.from("shifts").insert({
    tenant_id: ctx.tenantId as string, user_id: v.userId, location_id: loc?.id ?? null, starts_at: at(ctx, v.date, v.start), ends_at: at(ctx, v.date, v.end), role_label: v.roleLabel || null,
  });
  if (error) return fail("Couldn't add the shift.");
  revalidatePath("/desk/staff/shifts");
  return ok();
}

export async function deleteShift(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  if (!z.uuid().safeParse(input.id).success) return fail("Invalid shift");
  const { error } = await ctx.supabase.from("shifts").delete().eq("id", input.id);
  if (error) return fail("Couldn't remove the shift.");
  revalidatePath("/desk/staff/shifts");
  return ok();
}
