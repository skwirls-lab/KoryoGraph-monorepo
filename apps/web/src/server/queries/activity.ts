import "server-only";
import type { Ctx } from "../context";

/** Recent check-ins and 12 weekly buckets (oldest → newest) for a person's attendance tab. */
export async function attendanceSummary(ctx: Ctx, personId: string) {
  const now = Date.now();
  const since = now - 84 * 86_400_000;
  const [{ data: recent }, { data: velocity }] = await Promise.all([
    ctx.supabase.from("attendance").select("id, source, checked_in_at, class_sessions(name, starts_at)").eq("person_id", personId).order("checked_in_at", { ascending: false }).limit(40),
    ctx.supabase.from("v_attendance_velocity").select("last_attended_at, classes_30d, classes_prev_30d, streak_weeks").eq("person_id", personId).maybeSingle(),
  ]);
  const weeks = Array.from({ length: 12 }, (_, i) => ({ start: since + i * 7 * 86_400_000, n: 0 }));
  for (const a of recent ?? []) {
    const t = new Date(a.class_sessions?.starts_at ?? a.checked_in_at).getTime();
    const w = weeks.find((x) => t >= x.start && t < x.start + 7 * 86_400_000);
    if (w) w.n++;
  }
  return { recent: recent ?? [], velocity, weekly: weeks.map((w) => w.n) };
}
