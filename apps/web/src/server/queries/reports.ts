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

export async function attendanceReport(ctx: Ctx, weeks: number) {
  const today = localDate(new Date(), ctx.tz);
  const from = addDays(today, -7 * weeks);
  const { data, error } = await ctx.supabase.from("v_attendance_by_class").select("week_start, class_name, sessions, attendances").gte("week_start", from).lte("week_start", today).order("week_start").range(0, 9999);
  if (error) throw new Error(`attendance: ${error.message}`);
  const rows = data ?? [];
  const byWeek = new Map<string, number>();
  for (let i = weeks; i >= 0; i--) {
    const d = new Date(`${addDays(today, -7 * i)}T12:00:00Z`);
    const monday = addDays(d.toISOString().slice(0, 10), -((d.getUTCDay() + 6) % 7));
    byWeek.set(monday, 0);
  }
  for (const r of rows) byWeek.set(r.week_start as string, (byWeek.get(r.week_start as string) ?? 0) + (r.attendances ?? 0));
  const weekly = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, value]) => ({
    week, value, label: new Date(`${week}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  }));
  return { rows, weekly };
}
