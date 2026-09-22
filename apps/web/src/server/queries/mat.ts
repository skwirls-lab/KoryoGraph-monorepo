import "server-only";
import { addDays, localDate, parseDate, zonedWallTimeToUtc } from "@koryo/scheduling";
import type { Ctx } from "../context";
import { getProgress } from "./progress";

export async function myLocationIds(ctx: Ctx): Promise<string[] | null> {
  const { data } = await ctx.supabase.from("tenant_users").select("location_ids").eq("user_id", ctx.userId).eq("tenant_id", ctx.tenantId ?? "").maybeSingle();
  return data?.location_ids?.length ? data.location_ids : null;
}

export async function todaySessions(ctx: Ctx) {
  const today = localDate(new Date(), ctx.tz);
  const from = zonedWallTimeToUtc({ ...parseDate(today), hour: 0, minute: 0 }, ctx.tz);
  const to = zonedWallTimeToUtc({ ...parseDate(addDays(today, 1)), hour: 0, minute: 0 }, ctx.tz);
  const locations = await myLocationIds(ctx);
  let q = ctx.supabase.from("class_sessions").select("id, name, starts_at, ends_at, status, capacity, instructor_ids, room, location_id")
    .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at");
  if (locations) q = q.in("location_id", locations);
  const { data, error } = await q;
  if (error) throw new Error(`todaySessions: ${error.message}`);
  const ids = (data ?? []).map((s) => s.id);
  const { data: stats } = ids.length ? await ctx.supabase.from("v_session_stats").select("*").in("session_id", ids) : { data: [] };
  const byId = new Map((stats ?? []).map((s) => [s.session_id, s]));
  const now = Date.now();
  const live = (data ?? []).filter((s) => s.status !== "cancelled");
  const currentId = live.find((s) => new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() > now)?.id;
  const nextId = live.find((s) => new Date(s.starts_at).getTime() > now)?.id;
  return (data ?? []).map((s) => ({
    ...s,
    mine: s.instructor_ids.includes(ctx.userId),
    stats: byId.get(s.id) ?? null,
    tag: s.id === currentId ? ("Now" as const) : s.id === nextId ? ("Next" as const) : null,
  }));
}

export interface MatRosterRow {
  personId: string;
  name: string;
  photoPath: string | null;
  allergies: string[];
  injuryFlags: string[];
  attended: boolean;
  bookingStatus: string | null;
  isExtra: boolean;
  rank: { name: string; color: string; stripes: number; stripesMax: number } | null;
  enrollmentId: string | null;
  eligibility: "eligible" | "almost" | "not_yet" | null;
  guardians: { name: string; phone: string | null }[];
}

export async function matSession(ctx: Ctx, id: string) {
  const { data: session } = await ctx.supabase
    .from("class_sessions")
    .select("id, name, starts_at, ends_at, status, cancel_reason, capacity, room, notes, lesson_plan_id, program_ids, lesson_plans(id, name, sections), locations(name)")
    .eq("id", id)
    .maybeSingle();
  if (!session) return null;
  const { data: roster } = await ctx.supabase.from("v_class_roster").select("*").eq("session_id", id).order("first_name").order("last_name");
  const personIds = (roster ?? []).map((r) => r.person_id as string);
  const [progress, guardians, plans] = await Promise.all([
    getProgress(ctx, { personIds }),
    personIds.length ? ctx.supabase.rpc("message_recipients", { p_person_ids: personIds }) : Promise.resolve({ data: [] }),
    ctx.supabase.from("lesson_plans").select("id, name").eq("is_template", true).order("name"),
  ]);
  const rows: MatRosterRow[] = (roster ?? []).map((r) => {
    const pr = progress.find((p) => p.personId === r.person_id && session.program_ids.includes(p.programId));
    return {
      personId: r.person_id as string,
      name: r.display_name ?? "",
      photoPath: r.photo_path,
      allergies: r.allergies ?? [],
      injuryFlags: r.injury_flags ?? [],
      attended: Boolean(r.attended),
      bookingStatus: r.booking_status,
      isExtra: Boolean(r.is_extra),
      rank: r.rank_name ? { name: r.rank_name, color: r.belt_color ?? "#f5f5f5", stripes: r.stripes ?? 0, stripesMax: r.stripes_max ?? 0 } : null,
      enrollmentId: r.enrollment_id,
      eligibility: pr?.eligibility.status ?? null,
      guardians: (guardians.data ?? [])
        .filter((g) => g.person_id === r.person_id && g.recipient_person_id !== r.person_id)
        .map((g) => ({ name: `${g.first_name} ${g.last_name}`, phone: g.phone })),
    };
  });
  return { session, rows, progress, lessonPlans: plans.data ?? [] };
}
