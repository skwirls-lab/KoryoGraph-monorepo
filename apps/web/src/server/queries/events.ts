import "server-only";
import { displayName } from "@/lib/people";
import type { RegisterDay, RegisterPerson } from "@/components/events/register-form";
import type { Ctx } from "../context";
import { fetchAll } from "../lib/fetch-all";

export interface EventRow {
  id: string;
  kind: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  waiver_template_ids: string[];
  pricing: unknown;
  status: string;
  registration_closes_at: string | null;
  host_household_id: string | null;
  deposit_cents: number | null;
  deposit_invoice_id: string | null;
  guest_link_token_hash: string | null;
}

export function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

/** Days of an event with the spots left on each (null = no limit). */
export async function eventDays(ctx: Ctx, ev: Pick<EventRow, "id" | "capacity">): Promise<(RegisterDay & { date: string; taken: number })[]> {
  const [{ data: days }, { data: regs }] = await Promise.all([
    ctx.supabase.from("event_days").select("id, date").eq("event_id", ev.id).order("date"),
    ctx.supabase.from("event_registrations").select("days").eq("event_id", ev.id).neq("status", "cancelled"),
  ]);
  return (days ?? []).map((d) => {
    const taken = (regs ?? []).filter((r) => r.days?.includes(d.id)).length;
    return { id: d.id, date: d.date, label: dayLabel(d.date), taken, left: ev.capacity === null ? null : Math.max(ev.capacity - taken, 0) };
  });
}

/** The signed-in member and everyone in their households (a staff member on Home still sees only their family). */
export async function familyPersonIds(ctx: Ctx): Promise<string[]> {
  const { data: me } = await ctx.supabase.rpc("my_person_id");
  if (!me) return [];
  const { data: mine } = await ctx.supabase.from("household_members").select("household_id").eq("person_id", me);
  const { data: members } = mine?.length ? await ctx.supabase.from("household_members").select("person_id").in("household_id", mine.map((m) => m.household_id)) : { data: [] };
  return [...new Set([me, ...(members ?? []).map((m) => m.person_id)])];
}

/**
 * People who can be registered: every active student (Desk) or the family's own students (Home), minus those
 * already registered; each with allergies and the required waivers they haven't signed.
 */
export async function registerablePeople(ctx: Ctx, ev: Pick<EventRow, "id" | "waiver_template_ids">, scope: "desk" | "home"): Promise<RegisterPerson[]> {
  let people: { id: string; first_name: string; last_name: string; preferred_name: string | null; allergies: string[] }[];
  if (scope === "home") {
    const ids = await familyPersonIds(ctx);
    const { data } = ids.length ? await ctx.supabase.from("people").select("id, first_name, last_name, preferred_name, allergies, type_flags").in("id", ids).is("archived_at", null) : { data: [] };
    people = (data ?? []).filter((p) => p.type_flags.includes("student"));
  } else {
    people = await fetchAll((from, to) => ctx.supabase.from("people").select("id, first_name, last_name, preferred_name, allergies")
      .contains("type_flags", ["student"]).is("archived_at", null).in("status", ["active", "trial"]).order("last_name").order("first_name").range(from, to));
  }
  const [{ data: regs }, { data: templates }, sigs] = await Promise.all([
    ctx.supabase.from("event_registrations").select("person_id").eq("event_id", ev.id).neq("status", "cancelled"),
    ev.waiver_template_ids.length ? ctx.supabase.from("document_templates").select("id, name").in("id", ev.waiver_template_ids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ev.waiver_template_ids.length
      ? fetchAll((from, to) => ctx.supabase.from("signatures").select("template_id, person_id").in("template_id", ev.waiver_template_ids).range(from, to))
      : Promise.resolve([] as { template_id: string; person_id: string }[]),
  ]);
  const taken = new Set((regs ?? []).map((r) => r.person_id));
  const signed = new Set(sigs.map((s) => `${s.template_id}:${s.person_id}`));
  return people.filter((p) => !taken.has(p.id)).map((p) => ({
    id: p.id, name: displayName(p), allergies: p.allergies,
    missingWaivers: (templates ?? []).filter((t) => !signed.has(`${t.id}:${p.id}`)),
  }));
}

/** Names allowed to pick each person up: guardians marked can-pick-up in their household plus authorized pickups. */
export async function pickupNames(ctx: Ctx, personIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(personIds.map((id) => [id, []]));
  if (!personIds.length) return out;
  const [{ data: members }, { data: extra }] = await Promise.all([
    ctx.supabase.from("household_members").select("household_id, person_id").in("person_id", personIds),
    ctx.supabase.from("authorized_pickups").select("person_id, name").in("person_id", personIds),
  ]);
  const hh = [...new Set((members ?? []).map((m) => m.household_id))];
  const { data: guardians } = hh.length
    ? await ctx.supabase.from("household_members").select("household_id, people(first_name, last_name, preferred_name)").in("household_id", hh).or("can_pickup.eq.true,relationship.eq.guardian")
    : { data: [] };
  for (const m of members ?? []) {
    const names = (guardians ?? []).filter((g) => g.household_id === m.household_id && g.people).map((g) => displayName(g.people as NonNullable<typeof g.people>));
    out.get(m.person_id)?.push(...names);
  }
  for (const e of extra ?? []) out.get(e.person_id)?.push(e.name);
  for (const [k, v] of out) out.set(k, [...new Set(v)]);
  return out;
}
