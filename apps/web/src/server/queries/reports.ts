import "server-only";
import { addDays, localDate } from "@koryo/scheduling";
import type { Ctx } from "../context";

export async function rosterReport(ctx: Ctx, status?: string) {
  let q = ctx.supabase.from("v_member_roster").select("*").order("last_name").order("first_name").range(0, 4999);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`roster: ${error.message}`);
  return data ?? [];
}

export async function attendanceReport(ctx: Ctx, weeks: number, locationId: string | null = null) {
  const today = localDate(new Date(), ctx.tz);
  const d0 = new Date(`${today}T12:00:00Z`);
  const thisMonday = addDays(today, -((d0.getUTCDay() + 6) % 7));
  const from = addDays(thisMonday, -7 * weeks);
  let q = ctx.supabase.from("v_attendance_by_class").select("week_start, class_name, sessions, attendances").gte("week_start", from).lte("week_start", today);
  if (locationId) q = q.eq("location_id", locationId);
  const { data, error } = await q.order("week_start").range(0, 9999);
  if (error) throw new Error(`attendance: ${error.message}`);
  const rows = data ?? [];
  const byWeek = new Map<string, number>();
  // `weeks` full weeks plus the current (partial) week, aligned to Mondays.
  for (let i = weeks; i >= 0; i--) byWeek.set(addDays(thisMonday, -7 * i), 0);
  for (const r of rows) byWeek.set(r.week_start as string, (byWeek.get(r.week_start as string) ?? 0) + (r.attendances ?? 0));
  const weekly = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, value]) => ({
    week, value,
    label: `${new Date(`${week}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}${week === thisMonday ? " (so far)" : ""}`,
  }));
  return { rows, weekly };
}
