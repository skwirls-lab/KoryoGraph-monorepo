import { expandTemplate, planSessions, windowFor, type ScheduleException } from "@koryo/scheduling";
import type { TablesInsert } from "@koryo/db/types";
import type { Job } from "./types";

const DAYS_AHEAD = 90;

interface ExistingSession {
  id: string;
  template_id: string | null;
  occurrence_date: string;
  starts_at: string;
  ends_at: string;
  status: string;
  name: string;
  capacity: number | null;
  instructor_ids: string[];
  program_ids: string[];
  room: string | null;
  cancel_reason: string | null;
  bookable: boolean;
  detached: boolean;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameInstant = (a: string, b: Date) => new Date(a).getTime() === b.getTime();

/**
 * Expands active class templates into class_sessions for today … +90 days (local to each location),
 * applying exceptions (cancel/modify) and holidays (drop). Diff-based and idempotent: a re-run with
 * no template changes writes nothing. Sessions that carry attendance or bookings are never deleted —
 * if they fall out of the schedule they are cancelled instead. `detached` sessions are left alone.
 * params.back = days of history to (re)materialise (seed/backfill).
 */
export const materializeSessions: Job = async ({ db, now, tenantId, log, params }) => {
  const back = Math.max(0, Number(params.back ?? 0) || 0);
  let q = db.from("class_templates").select("*, locations(timezone), tenants(timezone)").eq("active", true);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: templates, error } = await q;
  if (error) throw new Error(`templates: ${error.message}`);

  const stats = { templates: 0, inserted: 0, updated: 0, deleted: 0, cancelled: 0, unchanged: 0 };
  for (const t of templates ?? []) {
    stats.templates++;
    const tz = t.locations?.timezone ?? t.tenants?.timezone ?? "UTC";
    const { from, to } = windowFor(now, tz, DAYS_AHEAD, back);
    const rule = { rrule: t.rrule, startDate: t.start_date, startTime: t.start_time, untilDate: t.until_date, durationMin: t.duration_min, timeZone: tz };

    const [exceptions, holidays, existing] = await Promise.all([
      db.from("schedule_exceptions").select("date, kind, overrides, reason").eq("template_id", t.id).gte("date", from).lte("date", to),
      db.from("holidays").select("date, location_id").eq("tenant_id", t.tenant_id).gte("date", from).lte("date", to),
      db.from("class_sessions").select("id, template_id, occurrence_date, starts_at, ends_at, status, name, capacity, instructor_ids, program_ids, room, cancel_reason, bookable, detached").eq("template_id", t.id).gte("occurrence_date", from).lte("occurrence_date", to),
    ]);
    const holidaySet = new Set((holidays.data ?? []).filter((h) => !h.location_id || h.location_id === t.location_id).map((h) => h.date));
    const planned = planSessions(rule, expandTemplate(rule, from, to), (exceptions.data ?? []) as ScheduleException[], holidaySet);
    const byDate = new Map(((existing.data ?? []) as ExistingSession[]).map((s) => [s.occurrence_date, s]));

    const inserts: TablesInsert<"class_sessions">[] = [];
    for (const p of planned) {
      const desired = {
        name: t.name,
        program_ids: t.program_ids,
        status: p.status,
        cancel_reason: p.status === "cancelled" ? p.reason : null,
        capacity: p.overrides.capacity !== undefined ? p.overrides.capacity : t.capacity,
        instructor_ids: p.overrides.instructorIds ?? t.instructor_ids,
        room: p.overrides.room !== undefined ? p.overrides.room : t.room,
        bookable: t.bookable,
      };
      const cur = byDate.get(p.date);
      byDate.delete(p.date);
      if (!cur) {
        inserts.push({
          tenant_id: t.tenant_id, template_id: t.id, location_id: t.location_id, occurrence_date: p.date,
          starts_at: p.startsAt.toISOString(), ends_at: p.endsAt.toISOString(), cancellation_window_min: t.cancellation_window_min, ...desired,
        });
        continue;
      }
      if (cur.detached || cur.status === "completed") { stats.unchanged++; continue; }
      const changed =
        !sameInstant(cur.starts_at, p.startsAt) || !sameInstant(cur.ends_at, p.endsAt) || cur.status !== desired.status ||
        cur.name !== desired.name || cur.capacity !== desired.capacity || cur.room !== desired.room || cur.bookable !== desired.bookable ||
        cur.cancel_reason !== desired.cancel_reason || !same(cur.instructor_ids, desired.instructor_ids) || !same(cur.program_ids, desired.program_ids);
      if (!changed) { stats.unchanged++; continue; }
      const { error: e } = await db.from("class_sessions").update({ ...desired, starts_at: p.startsAt.toISOString(), ends_at: p.endsAt.toISOString() }).eq("id", cur.id);
      if (e) throw new Error(`update session: ${e.message}`);
      stats.updated++;
    }
    if (inserts.length) {
      const { error: e } = await db.from("class_sessions").insert(inserts);
      if (e) throw new Error(`insert sessions: ${e.message}`);
      stats.inserted += inserts.length;
    }

    // Occurrences no longer in the plan (holiday added, rule changed): delete if untouched, else cancel.
    for (const orphan of byDate.values()) {
      if (orphan.detached || orphan.status === "completed") continue;
      const [{ count: att }, { count: bk }] = await Promise.all([
        db.from("attendance").select("id", { count: "exact", head: true }).eq("session_id", orphan.id),
        db.from("bookings").select("id", { count: "exact", head: true }).eq("session_id", orphan.id).neq("status", "cancelled"),
      ]);
      if ((att ?? 0) + (bk ?? 0) === 0) {
        await db.from("class_sessions").delete().eq("id", orphan.id);
        stats.deleted++;
      } else if (orphan.status !== "cancelled") {
        await db.from("class_sessions").update({ status: "cancelled", cancel_reason: "Removed from the schedule" }).eq("id", orphan.id);
        stats.cancelled++;
      }
    }
  }
  log.info(stats, "materialize_sessions");
  return stats;
};
