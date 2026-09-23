"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney } from "@/lib/curriculum";
import { enrollSchema, markSchema, programSchema, splitList, type EnrollInput, type MarkInput, type ProgramInput } from "@/lib/validation/afterschool";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const staff = { permission: "events.manage", module: "programs_plus" } as const;
const known = (message: string | undefined, fallback: string) => {
  const m = message ?? "";
  return /choose|already enrolled|household first|required|arrived first|not found/.test(m) ? m.charAt(0).toUpperCase() + m.slice(1) + "." : fallback;
};

/** Create or update a program; with Billing, its weekly plan is created/updated in the same transaction. */
export async function saveAfterschoolProgram(input: ProgramInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const { data, error } = await ctx.supabase.rpc("save_afterschool_program", {
    p: { id: v.id ?? "", name: v.name, weekly_price_cents: parseMoney(v.weeklyPrice) ?? 0, schools: splitList(v.schools), routes: splitList(v.routes), days_of_week: v.days, pickup_cutoff: v.cutoff },
  });
  if (error || !data) return fail(error?.code === "42501" ? "You don't have permission to do that." : "Couldn't save the program.");
  revalidatePath("/desk/afterschool");
  if (v.id) {
    revalidatePath(`/desk/afterschool/${v.id}`);
    return ok({ id: v.id });
  }
  redirect(`/desk/afterschool/${data}`);
}

export async function enrollAfterschool(input: EnrollInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  const parsed = enrollSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the enrollment", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const { data, error } = await ctx.supabase.rpc("afterschool_enroll", {
    p_program_id: v.programId, p_person_id: v.personId, p_school: v.school, p_route: v.route, p_days: v.days, p_starts_on: v.startsOn,
  });
  if (error || !data) return fail(error?.code === "42501" ? "Enrolling needs the billing permission too (it starts weekly billing)." : known(error?.message, "Couldn't enroll."));
  revalidatePath(`/desk/afterschool/${v.programId}`);
  return ok({ id: data });
}

export async function endAfterschool(input: { enrollmentId: string; endsOn: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  const parsed = z.object({ enrollmentId: z.uuid(), endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(input);
  if (!parsed.success) return fail("Pick an end date");
  const { error } = await ctx.supabase.rpc("afterschool_end", { p_enrollment_id: parsed.data.enrollmentId, p_ends_on: parsed.data.endsOn });
  if (error) return fail(known(error.message, "Couldn't end the enrollment."));
  revalidatePath("/desk/afterschool", "layout");
  return ok();
}

/** Mark a child for a day. Release stores who picked up and a signature image; absent alerts guardians. */
export async function markAfterschool(input: MarkInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid attendance");
  const v = parsed.data;
  let path: string | null = null;
  if (v.action === "released") {
    if (v.releasedTo.length < 2) return fail("Who is picking up?");
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(v.signature);
    const bytes = m?.[1] ? Buffer.from(m[1], "base64") : null;
    if (!bytes || bytes.length < 200) return fail("A signature is required at pickup.");
    path = `${ctx.tenantId}/events/afterschool/${v.date}/${v.enrollmentId}-${Date.now()}.png`;
    const { error: upErr } = await ctx.supabase.storage.from("tenant-media").upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) return fail("Couldn't store the signature.");
  }
  const { error } = await ctx.supabase.rpc("afterschool_mark", {
    p_enrollment_id: v.enrollmentId, p_date: v.date, p_action: v.action,
    p_released_to: v.releasedTo || undefined, p_signature_path: path ?? undefined, p_reason: v.reason || undefined,
  });
  if (error) {
    if (path) await ctx.supabase.storage.from("tenant-media").remove([path]);
    return fail(known(error.message, "Couldn't record that."));
  }
  revalidatePath("/desk/afterschool", "layout");
  return ok();
}
