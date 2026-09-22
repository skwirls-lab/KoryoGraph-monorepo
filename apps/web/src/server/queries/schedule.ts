import "server-only";
import { addDays, localDate, zonedWallTimeToUtc, parseDate } from "@koryo/scheduling";
import type { Ctx } from "../context";

/** Monday (local) of the week containing `date`. */
export function weekStart(date: string): string {
  const { year, month, day } = parseDate(date);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

export async function staffOptions(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from("tenant_users")
    .select("user_id, roles(key, surface), profiles(full_name, email)")
    .eq("status", "active");
  return (data ?? [])
    .filter((u) => u.roles && ["owner", "admin", "instructor", "assistant_instructor"].includes(u.roles.key))
    .map((u) => ({ id: u.user_id, name: u.profiles?.full_name ?? u.profiles?.email ?? "Staff", role: u.roles?.key ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function scheduleOptions(ctx: Ctx) {
  const [locations, programs, staff] = await Promise.all([
    ctx.supabase.from("locations").select("id, name, is_default").is("archived_at", null).order("is_default", { ascending: false }).order("name"),
    ctx.supabase.from("programs").select("id, name, color, ranks(position, name)").eq("active", true).order("sort").order("name"),
    staffOptions(ctx),
  ]);
  return {
    locations: locations.data ?? [],
    programs: (programs.data ?? []).map((p) => ({ id: p.id, name: p.name, color: p.color, ranks: [...p.ranks].sort((a, b) => a.position - b.position) })),
    staff,
  };
}

export interface WeekSession {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  status: string;
  capacity: number | null;
  booked: number;
  waitlisted: number;
  attended: number;
  instructorIds: string[];
  programIds: string[];
  room: string | null;
  templateId: string | null;
}

export async function weekSessions(ctx: Ctx, week: string, f: { location?: string; program?: string }): Promise<WeekSession[]> {
  const from = zonedWallTimeToUtc({ ...parseDate(week), hour: 0, minute: 0 }, ctx.tz);
  const to = zonedWallTimeToUtc({ ...parseDate(addDays(week, 7)), hour: 0, minute: 0 }, ctx.tz);
  let q = ctx.supabase
    .from("class_sessions")
    .select("id, name, starts_at, ends_at, status, capacity, instructor_ids, program_ids, room, template_id, location_id")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (f.location) q = q.eq("location_id", f.location);
  if (f.program) q = q.contains("program_ids", [f.program]);
  const { data, error } = await q;
  if (error) throw new Error(`weekSessions: ${error.message}`);
  const ids = (data ?? []).map((s) => s.id);
  const { data: stats } = ids.length ? await ctx.supabase.from("v_session_stats").select("*").in("session_id", ids) : { data: [] };
  const byId = new Map((stats ?? []).map((s) => [s.session_id, s]));
  return (data ?? []).map((s) => {
    const st = byId.get(s.id);
    return {
      id: s.id, name: s.name, startsAt: s.starts_at, endsAt: s.ends_at, localDate: localDate(new Date(s.starts_at), ctx.tz), status: s.status,
      capacity: s.capacity, booked: st?.booked ?? 0, waitlisted: st?.waitlisted ?? 0, attended: st?.attended ?? 0,
      instructorIds: s.instructor_ids, programIds: s.program_ids, room: s.room, templateId: s.template_id,
    };
  });
}

export async function getClassSession(ctx: Ctx, id: string) {
  const { data: session, error } = await ctx.supabase
    .from("class_sessions")
    .select("*, class_templates(id, name, rrule, start_time), locations(name), lesson_plans(id, name, sections)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getSession: ${error.message}`);
  if (!session) return null;
  const [roster, comms] = await Promise.all([
    ctx.supabase.from("v_class_roster").select("*").eq("session_id", id).order("last_name").order("first_name"),
    ctx.permissions.has("comms.send")
      ? ctx.supabase.from("communications").select("id, channel, status, to_address, created_at").eq("related_type", "class_session").eq("related_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  return { session, roster: roster.data ?? [], communications: comms.data ?? [] };
}

export async function listTemplates(ctx: Ctx) {
  const { data, error } = await ctx.supabase.from("class_templates").select("*, locations(name)").order("active", { ascending: false }).order("name");
  if (error) throw new Error(`listTemplates: ${error.message}`);
  return data ?? [];
}

export async function listHolidays(ctx: Ctx) {
  const { data } = await ctx.supabase.from("holidays").select("id, date, name, locations(name)").gte("date", addDays(localDate(new Date(), ctx.tz), -30)).order("date");
  return data ?? [];
}
