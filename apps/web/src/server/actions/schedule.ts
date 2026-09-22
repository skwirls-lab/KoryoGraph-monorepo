"use server";

import { weeklyRule } from "@koryo/scheduling";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatDate } from "@koryo/ui/components/app/date-text";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { cancelSessionSchema, holidaySchema, templateSchema, type TemplateInput } from "@/lib/validation/schedule";
import { notify } from "../comms";
import { getCtx, type Ctx } from "../context";
import { materializeSessions } from "../jobs/materialize-sessions";
import { authorize } from "../lib/authorize";
import { logger } from "../log";

const numOrNull = (v: unknown) => (v === "" || v === undefined || v === null ? null : Number(v));

/** Re-materialise with the user's own (RLS-scoped) client — no service role on a request path. */
async function rematerialize(ctx: Ctx, templateId?: string) {
  await materializeSessions({ db: ctx.supabase, now: new Date(), tenantId: ctx.tenantId, log: logger(ctx), params: templateId ? { template: templateId } : {} });
}

export async function saveTemplate(input: TemplateInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "schedule.manage" });
  if (denied) return denied;
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const row = {
    name: v.name, location_id: v.locationId, program_ids: v.programIds, rrule: weeklyRule(v.days, v.interval), start_time: v.startTime,
    duration_min: v.durationMin, start_date: v.startDate, until_date: v.untilDate || null, capacity: numOrNull(v.capacity),
    instructor_ids: v.instructorIds, rank_min_position: numOrNull(v.rankMin), rank_max_position: numOrNull(v.rankMax),
    age_min: numOrNull(v.ageMin), age_max: numOrNull(v.ageMax), room: v.room || null, bookable: v.bookable,
    cancellation_window_min: v.cancellationWindowMin, active: true,
  };
  let id = v.id;
  if (id) {
    const { error } = await ctx.supabase.from("class_templates").update(row).eq("id", id);
    if (error) return fail("Couldn't save the class.");
  } else {
    const { data, error } = await ctx.supabase.from("class_templates").insert({ ...row, tenant_id: ctx.tenantId as string }).select("id").single();
    if (error || !data) return fail("Couldn't create the class.");
    id = data.id;
  }
  try {
    await rematerialize(ctx, id);
  } catch (err) {
    logger(ctx).error({ err: err instanceof Error ? err.message : String(err) }, "materialize after save failed");
    return fail("Saved, but sessions couldn't be generated yet — the nightly job will retry.");
  }
  revalidatePath("/desk/schedule", "layout");
  return ok({ id: id as string });
}

export async function deactivateTemplate(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "schedule.manage" });
  if (denied) return denied;
  const { error } = await ctx.supabase.from("class_templates").update({ active: false, until_date: new Date().toISOString().slice(0, 10) }).eq("id", input.id);
  if (error) return fail("Couldn't end the class.");
  // Future sessions: delete untouched ones, cancel ones with bookings/attendance.
  const { data: future } = await ctx.supabase.from("class_sessions").select("id").eq("template_id", input.id).gt("starts_at", new Date().toISOString()).eq("status", "scheduled");
  for (const s of future ?? []) {
    const [{ count: a }, { count: b }] = await Promise.all([
      ctx.supabase.from("attendance").select("id", { count: "exact", head: true }).eq("session_id", s.id),
      ctx.supabase.from("bookings").select("id", { count: "exact", head: true }).eq("session_id", s.id).neq("status", "cancelled"),
    ]);
    if ((a ?? 0) + (b ?? 0) === 0) await ctx.supabase.from("class_sessions").delete().eq("id", s.id);
    else await ctx.supabase.from("class_sessions").update({ status: "cancelled", cancel_reason: "Class discontinued" }).eq("id", s.id);
  }
  revalidatePath("/desk/schedule", "layout");
  return ok();
}

/** People to notify about a session: booked/waitlisted + expected roster. */
async function sessionAudience(ctx: Ctx, sessionId: string): Promise<string[]> {
  const { data } = await ctx.supabase.from("v_class_roster").select("person_id, booking_status").eq("session_id", sessionId);
  return [...new Set((data ?? []).filter((r) => r.booking_status !== "cancelled").map((r) => r.person_id as string))];
}

export async function cancelSession(input: z.input<typeof cancelSessionSchema>): Promise<ActionResult<{ notified: Record<string, number> }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "schedule.manage" });
  if (denied) return denied;
  const parsed = cancelSessionSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request");
  const { sessionId, reason, notify: shouldNotify } = parsed.data;
  const { data: s } = await ctx.supabase.from("class_sessions").select("id, name, starts_at, template_id, occurrence_date, status").eq("id", sessionId).maybeSingle();
  if (!s) return fail("Session not found");
  if (s.status === "cancelled") return fail("Already cancelled");
  if (s.template_id) {
    const { error } = await ctx.supabase.from("schedule_exceptions").upsert(
      { tenant_id: ctx.tenantId as string, template_id: s.template_id, date: s.occurrence_date, kind: "cancel", reason: reason || null, overrides: {} },
      { onConflict: "template_id,date" },
    );
    if (error) return fail("Couldn't cancel the class.");
  }
  const { error } = await ctx.supabase.from("class_sessions").update({ status: "cancelled", cancel_reason: reason || null }).eq("id", sessionId);
  if (error) return fail("Couldn't cancel the class.");
  let notified: Record<string, number> = {};
  if (shouldNotify) {
    const audience = await sessionAudience(ctx, sessionId);
    const summary = await notify(ctx, {
      personIds: audience,
      templateKey: "class_cancelled",
      data: { class_name: s.name, class_time: formatDate(s.starts_at, ctx.tz, "datetime"), reason: reason || null },
      related: { type: "class_session", id: sessionId },
    });
    notified = summary.byStatus;
  }
  revalidatePath("/desk/schedule", "layout");
  return ok({ notified });
}

export async function changeSessionInstructors(input: { sessionId: string; instructorIds: string[] }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "schedule.manage" });
  if (denied) return denied;
  const parsed = z.object({ sessionId: z.uuid(), instructorIds: z.array(z.uuid()).max(10) }).safeParse(input);
  if (!parsed.success) return fail("Invalid request");
  const { data: s } = await ctx.supabase.from("class_sessions").select("template_id, occurrence_date").eq("id", parsed.data.sessionId).maybeSingle();
  if (!s) return fail("Session not found");
  if (s.template_id) {
    const { data: existing } = await ctx.supabase.from("schedule_exceptions").select("kind, overrides").eq("template_id", s.template_id).eq("date", s.occurrence_date).maybeSingle();
    if (existing?.kind !== "cancel") {
      const overrides = { ...((existing?.overrides as Record<string, unknown>) ?? {}), instructorIds: parsed.data.instructorIds };
      await ctx.supabase.from("schedule_exceptions").upsert(
        { tenant_id: ctx.tenantId as string, template_id: s.template_id, date: s.occurrence_date, kind: "modify", overrides },
        { onConflict: "template_id,date" },
      );
    }
  }
  const { error } = await ctx.supabase.from("class_sessions").update({ instructor_ids: parsed.data.instructorIds }).eq("id", parsed.data.sessionId);
  if (error) return fail("Couldn't change the instructor.");
  revalidatePath("/desk/schedule", "layout");
  return ok();
}

export async function setSessionNote(input: { sessionId: string; notes: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "attendance.write" });
  if (denied) return denied;
  const parsed = z.object({ sessionId: z.uuid(), notes: z.string().max(4000) }).safeParse(input);
  if (!parsed.success) return fail("Invalid note");
  const { error } = await ctx.supabase.from("class_sessions").update({ notes: parsed.data.notes || null }).eq("id", parsed.data.sessionId);
  if (error) return fail("Couldn't save the note.");
  revalidatePath("/desk/schedule", "layout");
  return ok();
}

export async function addHoliday(input: z.input<typeof holidaySchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "schedule.manage" });
  if (denied) return denied;
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const { error } = await ctx.supabase.from("holidays").insert({ tenant_id: ctx.tenantId as string, date: parsed.data.date, name: parsed.data.name, location_id: parsed.data.locationId || null });
  if (error) return fail(error.code === "23505" ? "There's already a holiday on that date." : "Couldn't add the holiday.");
  await rematerialize(ctx);
  revalidatePath("/desk/schedule", "layout");
  return ok();
}

export async function deleteHoliday(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "schedule.manage" });
  if (denied) return denied;
  const { error } = await ctx.supabase.from("holidays").delete().eq("id", input.id);
  if (error) return fail("Couldn't remove the holiday.");
  await rematerialize(ctx);
  revalidatePath("/desk/schedule", "layout");
  return ok();
}
