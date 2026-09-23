"use server";

import { zonedWallTimeToUtc } from "@koryo/scheduling";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney } from "@/lib/curriculum";
import { eventDates, eventSchema, registerSchema, type EventInput, type RegisterInput } from "@/lib/validation/events";
import { getCtx, type Ctx } from "../context";
import { authorize } from "../lib/authorize";

const staff = { permission: "events.manage", module: "programs_plus" } as const;
const known = (message: string | undefined, fallback: string) => {
  const m = message ?? "";
  return /closed|full|already registered|sign the required waiver|choose|confirm the allergy|not registered|required|check in first|set the host/.test(m) ? m.charAt(0).toUpperCase() + m.slice(1) + "." : fallback;
};

function at(ctx: Ctx, date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  return zonedWallTimeToUtc({ year: y, month: mo, day: d, hour: h, minute: mi }, ctx.tz);
}

/**
 * Create or update an event. Every event gets a day row per date (one for a single-day event): camp families
 * choose days, capacity is counted per day, and check-in/out is per day. Days with registrations are kept.
 */
export async function saveEvent(input: EventInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const pricing = v.pricing.map((p) => ({ label: p.label, price_cents: parseMoney(p.price) ?? 0, per: p.per }));
  const deposit = v.deposit ? parseMoney(v.deposit) : null;
  const dates = v.startDate === v.endDate ? [v.startDate] : eventDates(v.startDate, v.endDate, v.weekdaysOnly);
  if (!dates.length) return fail("Check the highlighted fields", { endDate: "No days in that range" });
  const row = {
    kind: v.kind, name: v.name, description: v.description,
    starts_at: at(ctx, v.startDate, v.startTime).toISOString(), ends_at: at(ctx, v.endDate, v.endTime).toISOString(),
    capacity: v.capacity === "" ? null : v.capacity, waiver_template_ids: v.waiverIds, pricing,
    registration_closes_at: v.closesDate ? at(ctx, v.closesDate, "23:59").toISOString() : null,
    host_household_id: v.kind === "party" && v.hostHouseholdId ? v.hostHouseholdId : null,
    deposit_cents: v.kind === "party" ? deposit : null,
  };
  let id = v.id;
  if (id) {
    const { error } = await ctx.supabase.from("events").update(row).eq("id", id);
    if (error) return fail("Couldn't save the event.");
  } else {
    const { data: loc } = await ctx.supabase.from("locations").select("id").eq("is_default", true).maybeSingle();
    const { data, error } = await ctx.supabase.from("events").insert({ ...row, tenant_id: ctx.tenantId as string, location_id: loc?.id ?? null, created_by: ctx.userId }).select("id").single();
    if (error || !data) return fail("Couldn't create the event.");
    id = data.id;
  }
  const { data: existing } = await ctx.supabase.from("event_days").select("id, date").eq("event_id", id);
  const keep = new Set(dates);
  const { data: regs } = await ctx.supabase.from("event_registrations").select("days").eq("event_id", id).neq("status", "cancelled");
  const used = new Set((regs ?? []).flatMap((r) => r.days ?? []));
  const drop = (existing ?? []).filter((d) => !keep.has(d.date) && !used.has(d.id)).map((d) => d.id);
  if (drop.length) await ctx.supabase.from("event_days").delete().in("id", drop);
  const have = new Set((existing ?? []).map((d) => d.date));
  const add = dates.filter((d) => !have.has(d)).map((d) => ({
    tenant_id: ctx.tenantId as string, event_id: id as string, date: d,
    starts_at: at(ctx, d, v.startTime).toISOString(), ends_at: at(ctx, d, v.endTime).toISOString(),
  }));
  if (add.length) {
    const { error } = await ctx.supabase.from("event_days").insert(add);
    if (error) return fail("The event was saved but its days couldn't be.");
  }
  revalidatePath("/desk/events");
  if (v.id) {
    revalidatePath(`/desk/events/${id}`);
    return ok({ id });
  }
  redirect(`/desk/events/${id}`);
}

export async function setEventStatus(input: { eventId: string; status: "draft" | "open" | "closed" | "completed" | "cancelled" }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  const parsed = z.object({ eventId: z.uuid(), status: z.enum(["draft", "open", "closed", "completed", "cancelled"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid status");
  const { error } = await ctx.supabase.from("events").update({ status: parsed.data.status }).eq("id", parsed.data.eventId);
  if (error) return fail("Couldn't change the status.");
  revalidatePath(`/desk/events/${parsed.data.eventId}`);
  return ok();
}

/** Register a student (Desk staff or the student's own family from Home). The database checks everything. */
export async function registerForEvent(input: RegisterInput): Promise<ActionResult<{ invoiceId: string | null; priceCents: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { module: "programs_plus" });
  if (denied) return denied;
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the registration", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const { data, error } = await ctx.supabase.rpc("register_for_event", {
    p_event_id: v.eventId, p_person_id: v.personId, p_option_label: v.option, p_day_ids: v.dayIds.length ? v.dayIds : undefined,
    p_allergies_ack: v.allergiesAck, p_notes: v.notes || undefined,
  });
  if (error || !data) return fail(error?.code === "42501" ? "You can only register your own family." : known(error?.message, "Couldn't register."));
  const r = z.object({ invoice_id: z.uuid().nullable(), price_cents: z.number() }).parse(data);
  revalidatePath(`/desk/events/${v.eventId}`);
  revalidatePath(`/home/events/${v.eventId}`);
  return ok({ invoiceId: r.invoice_id, priceCents: r.price_cents });
}

/** Cancel a registration; an unpaid event invoice is voided with it. */
export async function cancelRegistration(input: { registrationId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  if (!z.uuid().safeParse(input.registrationId).success) return fail("Invalid registration");
  const { data: r } = await ctx.supabase.from("event_registrations").select("id, event_id, invoice_id, invoices(status, balance_cents, total_cents)").eq("id", input.registrationId).maybeSingle();
  if (!r) return fail("Registration not found.");
  if (r.invoice_id && r.invoices && r.invoices.status === "open" && r.invoices.balance_cents === r.invoices.total_cents && ctx.permissions.has("billing.charge")) {
    await ctx.supabase.rpc("void_invoice", { p_invoice_id: r.invoice_id, p_reason: "Event registration cancelled" });
  }
  const { error } = await ctx.supabase.from("event_registrations").update({ status: "cancelled" }).eq("id", r.id);
  if (error) return fail("Couldn't cancel the registration.");
  revalidatePath(`/desk/events/${r.event_id}`);
  return ok();
}

const checkSchema = z.object({
  dayId: z.uuid(),
  personId: z.uuid(),
  action: z.enum(["in", "out"]),
  pickupName: z.string().trim().max(120).default(""),
  /** PNG data URL from the signature pad (check-out only). */
  signature: z.string().max(400_000).default(""),
});

/** Day check-in / check-out. Check-out stores the pickup's name and a signature image. */
export async function eventCheck(input: z.input<typeof checkSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid check-in");
  const v = parsed.data;
  let path: string | null = null;
  if (v.action === "out") {
    if (v.pickupName.length < 2) return fail("Who is picking up?");
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(v.signature);
    if (!m?.[1]) return fail("A signature is required at pickup.");
    const bytes = Buffer.from(m[1], "base64");
    if (bytes.length < 200) return fail("A signature is required at pickup.");
    const { data: day } = await ctx.supabase.from("event_days").select("event_id").eq("id", v.dayId).maybeSingle();
    if (!day) return fail("Day not found.");
    path = `${ctx.tenantId}/events/${day.event_id}/${v.dayId}/${v.personId}-${Date.now()}.png`;
    const { error: upErr } = await ctx.supabase.storage.from("tenant-media").upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) return fail("Couldn't store the signature.");
  }
  const { error } = await ctx.supabase.rpc("event_check", {
    p_day_id: v.dayId, p_person_id: v.personId, p_action: v.action, p_pickup_name: v.pickupName || undefined, p_signature_path: path ?? undefined,
  });
  if (error) {
    if (path) await ctx.supabase.storage.from("tenant-media").remove([path]);
    return fail(known(error.message, "Couldn't record that."));
  }
  revalidatePath("/desk/events", "layout");
  return ok();
}

/** A short-lived link to a check-out signature image. */
export async function signatureUrl(input: { path: string }): Promise<ActionResult<{ url: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  if (!input.path.startsWith(`${ctx.tenantId}/events/`)) return fail("Not found");
  const { data, error } = await ctx.supabase.storage.from("tenant-media").createSignedUrl(input.path, 300);
  if (error || !data) return fail("Couldn't open the signature.");
  return ok({ url: data.signedUrl });
}

/** A new guest waiver link for a party (replaces the previous one). */
export async function createGuestLink(input: { eventId: string }): Promise<ActionResult<{ token: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, staff);
  if (denied) return denied;
  if (!z.uuid().safeParse(input.eventId).success) return fail("Invalid event");
  const { data, error } = await ctx.supabase.rpc("party_guest_link", { p_event_id: input.eventId });
  if (error || !data) return fail("Couldn't create the link.");
  return ok({ token: data });
}

export async function createPartyDeposit(input: { eventId: string }): Promise<ActionResult<{ invoiceId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { ...staff, module: "billing" });
  if (denied) return denied;
  if (!z.uuid().safeParse(input.eventId).success) return fail("Invalid event");
  const { data, error } = await ctx.supabase.rpc("create_party_deposit", { p_event_id: input.eventId });
  if (error || !data) return fail(known(error?.message, "Couldn't create the deposit invoice."));
  revalidatePath(`/desk/events/${input.eventId}`);
  return ok({ invoiceId: data });
}
