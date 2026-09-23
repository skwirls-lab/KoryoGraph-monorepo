"use server";

import { DbError, rpc } from "@koryo/db";
import { describeGap } from "@koryo/eligibility";
import { zonedWallTimeToUtc } from "@koryo/scheduling";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney } from "@/lib/curriculum";
import { testingEventSchema, type TestingEventInput } from "@/lib/validation/testing";
import { notify } from "../comms";
import { getCtx, type Ctx } from "../context";
import { authorize } from "../lib/authorize";
import { logger } from "../log";
import { renderCertificatePdf } from "../testing/certificate";
import { testingRoster } from "../testing/roster";

const need = { permission: "testing.manage" } as const;
const dbMessage = (err: unknown, fallback: string) => (err instanceof DbError && ["22023", "P0002"].includes(err.code ?? "") ? err.message.charAt(0).toUpperCase() + err.message.slice(1) + "." : fallback);



export async function saveTestingEvent(input: TestingEventInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = testingEventSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const fee = parseMoney(v.fee);
  if (fee === null) return fail("Check the highlighted fields", { fee: "Enter an amount like 45.00" });
  const [y, mo, d] = v.date.split("-").map(Number) as [number, number, number];
  const [h, mi] = v.time.split(":").map(Number) as [number, number];
  const starts = zonedWallTimeToUtc({ year: y, month: mo, day: d, hour: h, minute: mi }, ctx.tz);
  const row = {
    name: v.name, starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + v.durationMin * 60_000).toISOString(), program_ids: v.programIds,
    fee_cents: fee, registration_deadline: v.deadline || null, capacity: v.capacity === "" ? null : v.capacity, judges: v.judgeIds, notes: v.notes || null,
  };
  if (v.id) {
    const { error } = await ctx.supabase.from("testing_events").update(row).eq("id", v.id);
    if (error) return fail("Couldn't save the test.");
    revalidatePath(`/desk/testing/${v.id}`);
    return ok({ id: v.id });
  }
  const { data: loc } = await ctx.supabase.from("locations").select("id").eq("is_default", true).maybeSingle();
  const { data, error } = await ctx.supabase.from("testing_events").insert({ ...row, tenant_id: ctx.tenantId as string, location_id: loc?.id ?? null, created_by: ctx.userId }).select("id").single();
  if (error || !data) return fail("Couldn't create the test.");
  redirect(`/desk/testing/${data.id}`);
}

export async function setTestingStatus(input: { eventId: string; status: "draft" | "open" | "closed" | "completed" }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const { error } = await ctx.supabase.from("testing_events").update({ status: input.status }).eq("id", input.eventId);
  if (error) return fail("Couldn't change the status.");
  revalidatePath(`/desk/testing/${input.eventId}`);
  return ok();
}

const inviteSchema = z.object({
  eventId: z.uuid(),
  enrollmentIds: z.array(z.uuid()).min(1, { error: "Choose students to invite" }).max(300),
  /** Required when any chosen student isn't eligible (manual add). */
  overrideReason: z.string().trim().max(300).default(""),
});

/**
 * Invite students: a registration per enrollment with its eligibility snapshot, and a test_invitation
 * message to each family (email/SMS per consent; Outbox when no provider).
 */
export async function inviteToTesting(input: z.input<typeof inviteSchema>): Promise<ActionResult<{ invited: number; notAutoEligible: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the invitation");
  const v = parsed.data;
  const { data: ev } = await ctx.supabase.from("testing_events").select("id, name, starts_at, fee_cents, registration_deadline, program_ids, status").eq("id", v.eventId).maybeSingle();
  if (!ev) return fail("Test not found.");
  if (ev.status !== "open") return fail("Open the test for registration before inviting.");
  const roster = await testingRoster(ctx, ev);
  const chosen = roster.filter((c) => v.enrollmentIds.includes(c.enrollmentId) && !c.registration && c.nextRank);
  if (!chosen.length) return fail("Those students are already invited or have no next rank.");
  const notEligible = chosen.filter((c) => c.eligibility.status !== "eligible");
  if (notEligible.length && v.overrideReason.length < 3) return fail(`${notEligible.length} of these aren't eligible yet — give a reason to add them anyway.`, { overrideReason: "Give a reason" });
  const now = new Date().toISOString();
  const { error } = await ctx.supabase.from("testing_registrations").insert(chosen.map((c) => ({
    tenant_id: ctx.tenantId as string, testing_event_id: ev.id, enrollment_id: c.enrollmentId, person_id: c.personId, to_rank_id: c.nextRank?.id ?? null,
    status: "invited", invited_at: now,
    eligibility_snapshot: { status: c.eligibility.status, gaps: c.eligibility.gaps.map((g) => describeGap(g, (id) => c.skillNames.get(id) ?? id)) },
    override_reason: c.eligibility.status === "eligible" ? null : v.overrideReason,
  })));
  if (error) return fail(error.code === "23505" ? "Some of these students are already on the roster." : "Couldn't invite.");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
  const when = new Date(ev.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  for (const c of chosen) {
    try {
      await notify(ctx, {
        personIds: [c.personId], templateKey: "test_invitation", channels: ["email", "sms"],
        data: { event_name: ev.name, event_date: when, rank_name: c.nextRank?.name ?? "", fee: ev.fee_cents ? formatMoney(ev.fee_cents, ctx.currency) : "none", deadline: ev.registration_deadline ?? "the test date", link: `${appUrl}/home/testing/${ev.id}` },
        related: { type: "testing_event", id: ev.id },
      });
    } catch (err) {
      logger(ctx).warn({ err: err instanceof Error ? err.message : String(err) }, "test invitation message failed");
    }
  }
  revalidatePath(`/desk/testing/${ev.id}`);
  return ok({ invited: chosen.length, notAutoEligible: notEligible.length });
}

export async function setRegistrationStatus(input: { registrationId: string; status: "confirmed" | "withdrawn" | "paid" }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({ registrationId: z.uuid(), status: z.enum(["confirmed", "withdrawn", "paid"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  const { data, error } = await ctx.supabase.from("testing_registrations").update({ status: parsed.data.status }).eq("id", parsed.data.registrationId).select("testing_event_id").maybeSingle();
  if (error || !data) return fail("Couldn't update the registration.");
  revalidatePath(`/desk/testing/${data.testing_event_id}`);
  return ok();
}

/** Staff register on the family's behalf (creates the fee invoice, like Home does). */
export async function registerOnBehalf(registrationId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  try {
    await rpc(ctx.supabase, "register_for_testing", { p_registration_id: registrationId });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't register."));
  }
  revalidatePath("/desk/testing", "layout");
  return ok();
}

async function canJudge(ctx: Ctx, eventId: string): Promise<boolean> {
  if (ctx.permissions.has("testing.manage")) return true;
  const { data } = await ctx.supabase.from("testing_events").select("judges").eq("id", eventId).maybeSingle();
  return Boolean(data?.judges.includes(ctx.userId));
}

const scoreSchema = z.object({
  registrationId: z.uuid(),
  scores: z.record(z.string(), z.number().min(0).max(10)),
  result: z.enum(["pass", "conditional", "fail"]),
  comments: z.string().trim().max(2000).default(""),
});

/** One judge's scoresheet for one student (rubric = the next rank's skills, 0–10 each). */
export async function saveScore(input: z.input<typeof scoreSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = scoreSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the scores");
  const v = parsed.data;
  const { data: reg } = await ctx.supabase.from("testing_registrations").select("id, testing_event_id, status").eq("id", v.registrationId).maybeSingle();
  if (!reg) return fail("Registration not found.");
  if (!(await canJudge(ctx, reg.testing_event_id))) return fail("You aren't a judge for this test.");
  if (!["paid", "confirmed", "passed", "conditional", "failed"].includes(reg.status)) return fail("Only confirmed (paid) students can be scored.");
  const values = Object.values(v.scores);
  const total = values.length ? Math.round((values.reduce((s, x) => s + x, 0) / values.length) * 100) / 100 : null;
  const { error } = await ctx.supabase.from("testing_scores").upsert({
    tenant_id: ctx.tenantId as string, registration_id: v.registrationId, judge_user_id: ctx.userId, scores: v.scores, total, result: v.result, comments: v.comments || null,
  }, { onConflict: "registration_id,judge_user_id" });
  if (error) return fail("Couldn't save the scores.");
  // The registration's result follows the judges: any fail → failed; else any conditional → conditional; else passed.
  const { data: all } = await ctx.supabase.from("testing_scores").select("result").eq("registration_id", v.registrationId);
  const results = (all ?? []).map((s) => s.result);
  const status = results.includes("fail") ? "failed" : results.includes("conditional") ? "conditional" : "passed";
  await ctx.supabase.from("testing_registrations").update({ status, result_notes: v.comments || null }).eq("id", v.registrationId);
  revalidatePath(`/desk/testing/${reg.testing_event_id}`);
  return ok();
}

/**
 * Promote everyone selected who passed (or passed conditionally): promotion + rank history, stripes and
 * class counter reset, congratulation queued; then a certificate PDF per promotion stored privately.
 */
export async function bulkPromote(input: { eventId: string; registrationIds: string[] }): Promise<ActionResult<{ promoted: number; certificates: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: ["testing.manage", "ranks.promote"] });
  if (denied) return denied;
  const parsed = z.object({ eventId: z.uuid(), registrationIds: z.array(z.uuid()).min(1, { error: "Choose students to promote" }) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Choose students");
  let rows: { registration_id: string; promotion_id: string }[];
  try {
    rows = (await rpc(ctx.supabase, "bulk_promote", { p_event_id: parsed.data.eventId, p_registration_ids: parsed.data.registrationIds })) as typeof rows;
  } catch (err) {
    return fail(dbMessage(err, "Couldn't promote."));
  }
  let certificates = 0;
  if (rows.length) {
    const [{ data: promos }, { data: tpl }, { data: tenant }] = await Promise.all([
      ctx.supabase.from("promotions").select("id, promoted_at, enrollments(people(first_name, last_name, preferred_name)), to_rank:ranks!promotions_tenant_id_to_rank_id_fkey(name, belt_color)").in("id", rows.map((r) => r.promotion_id)),
      ctx.supabase.from("certificate_templates").select("title, body, signer_name, signer_title").eq("is_default", true).maybeSingle(),
      ctx.supabase.from("tenants").select("name").eq("id", ctx.tenantId as string).single(),
    ]);
    for (const p of promos ?? []) {
      const person = p.enrollments?.people;
      const studentName = person ? `${person.preferred_name || person.first_name} ${person.last_name}`.trim() : "Student";
      const rankName = p.to_rank?.name ?? "";
      const date = new Date(p.promoted_at).toLocaleDateString("en-US", { timeZone: ctx.tz, dateStyle: "long" });
      const body = (tpl?.body ?? "This certifies that {{student_name}} has been promoted to {{rank_name}} on {{date}}.")
        .replaceAll("{{student_name}}", studentName).replaceAll("{{rank_name}}", rankName).replaceAll("{{date}}", date);
      try {
        const bytes = await renderCertificatePdf({ schoolName: tenant?.name ?? "", title: tpl?.title ?? "Certificate of Rank", body, studentName, rankName, beltColor: p.to_rank?.belt_color ?? "#333333", date, signerName: tpl?.signer_name ?? null, signerTitle: tpl?.signer_title ?? null });
        const path = `${ctx.tenantId}/certificates/${parsed.data.eventId}/${p.id}.pdf`;
        const { error } = await ctx.supabase.storage.from("tenant-media").upload(path, bytes, { contentType: "application/pdf", upsert: false });
        if (!error) {
          await ctx.supabase.from("promotions").update({ certificate_path: path }).eq("id", p.id);
          certificates++;
        }
      } catch (err) {
        logger(ctx).warn({ err: err instanceof Error ? err.message : String(err) }, "certificate render failed");
      }
    }
  }
  revalidatePath(`/desk/testing/${parsed.data.eventId}`);
  revalidatePath("/home", "layout");
  return ok({ promoted: rows.length, certificates });
}

/** Home: register an invited student (fee invoice created; pay it on Billing). */
export async function registerForTesting(registrationId: string): Promise<ActionResult<{ invoiceId: string | null }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "home.access" });
  if (denied) return denied;
  if (!z.uuid().safeParse(registrationId).success) return fail("Invalid registration.");
  try {
    const invoiceId = await rpc(ctx.supabase, "register_for_testing", { p_registration_id: registrationId });
    revalidatePath("/home", "layout");
    return ok({ invoiceId: invoiceId ?? null });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't register."));
  }
}
