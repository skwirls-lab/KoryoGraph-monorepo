import "server-only";
import type { ManifestKid } from "@/components/afterschool/manifest-board";
import { displayName } from "@/lib/people";
import { isoDow } from "@/lib/validation/afterschool";
import type { Ctx } from "../context";
import { pickupNames } from "./events";

/** Children expected on a date (active, started, not ended, that weekday), with the day's attendance. */
export async function manifest(ctx: Ctx, programId: string, date: string): Promise<ManifestKid[]> {
  const { data: enr } = await ctx.supabase.from("afterschool_enrollments")
    .select("id, person_id, school, pickup_route, days_of_week, people(first_name, last_name, preferred_name, allergies)")
    .eq("program_id", programId).neq("status", "ended").lte("starts_on", date).or(`ends_on.is.null,ends_on.gte.${date}`)
    .contains("days_of_week", [isoDow(date)]);
  const rows = (enr ?? []).filter((e) => e.people);
  const [{ data: att }, pickups] = await Promise.all([
    rows.length ? ctx.supabase.from("afterschool_attendance").select("enrollment_id, picked_up_at, arrived_at, released_at, released_to, absent, absence_reason, alerted_at").eq("date", date).in("enrollment_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] }),
    pickupNames(ctx, rows.map((r) => r.person_id)),
  ]);
  return rows.map((e) => {
    const a = (att ?? []).find((x) => x.enrollment_id === e.id);
    return {
      enrollmentId: e.id, name: e.people ? displayName(e.people) : "Child", school: e.school, route: e.pickup_route ?? "No route",
      allergies: e.people?.allergies ?? [], pickups: pickups.get(e.person_id) ?? [],
      pickedUpAt: a?.picked_up_at ?? null, arrivedAt: a?.arrived_at ?? null, releasedAt: a?.released_at ?? null, releasedTo: a?.released_to ?? null,
      absent: a?.absent ?? false, absenceReason: a?.absence_reason ?? null, alerted: Boolean(a?.alerted_at),
    };
  }).sort((a, b) => a.route.localeCompare(b.route) || a.school.localeCompare(b.school) || a.name.localeCompare(b.name));
}
