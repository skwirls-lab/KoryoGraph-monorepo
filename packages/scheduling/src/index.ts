import * as rruleNs from "rrule";
import { addDays, localDate, parseDate, parseTime, zonedWallTimeToUtc } from "./time";

// rrule ships ESM (bundlers, Vitest) and a UMD main (Node ESM via tsx exposes only `default`).
const rrule = ((rruleNs as unknown as { default?: typeof rruleNs }).default ?? rruleNs) as typeof rruleNs;
const { RRule, Weekday } = rrule;
export * from "./time";

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof WEEKDAYS)[number];
const WEEKDAY_LABEL: Record<WeekdayCode, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };

export interface TemplateRule {
  /** RRULE body without DTSTART, e.g. "FREQ=WEEKLY;BYDAY=MO,WE". */
  rrule: string;
  /** First local date the rule may occur (YYYY-MM-DD). */
  startDate: string;
  /** Local wall-clock start time (HH:MM). */
  startTime: string;
  /** Last local date (inclusive), or null for open-ended. */
  untilDate: string | null;
  durationMin: number;
  timeZone: string;
}

export interface Occurrence {
  /** Local date of the occurrence (YYYY-MM-DD) — the key exceptions/holidays match on. */
  date: string;
  startsAt: Date;
  endsAt: Date;
}

/** Weekly rule string for the schedule builder. */
export function weeklyRule(days: readonly WeekdayCode[], interval = 1): string {
  const ordered = WEEKDAYS.filter((d) => days.includes(d));
  if (ordered.length === 0) throw new Error("Pick at least one day");
  return `FREQ=WEEKLY${interval > 1 ? `;INTERVAL=${interval}` : ""};BYDAY=${ordered.join(",")}`;
}

/** Days of a simple weekly rule (for editing), or null if the rule is something else. */
export function weeklyDays(rule: string): WeekdayCode[] | null {
  const opts = RRule.parseString(rule);
  if (opts.freq !== RRule.WEEKLY || !opts.byweekday) return null;
  const list = Array.isArray(opts.byweekday) ? opts.byweekday : [opts.byweekday];
  return list.map((w) => (w instanceof Weekday ? WEEKDAYS[w.weekday] : typeof w === "number" ? WEEKDAYS[w] : (w as WeekdayCode))).filter((x): x is WeekdayCode => Boolean(x));
}

export function describeRule(rule: string, startTime: string): string {
  const days = weeklyDays(rule);
  const t = parseTime(startTime);
  const time = new Date(Date.UTC(2000, 0, 1, t.hour, t.minute)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  if (days) {
    const interval = RRule.parseString(rule).interval ?? 1;
    return `${interval > 1 ? `Every ${interval} weeks on ` : ""}${days.map((d) => WEEKDAY_LABEL[d]).join(", ")} at ${time}`;
  }
  return `${new RRule(RRule.parseString(rule)).toText()} at ${time}`;
}

/**
 * Occurrences of a template whose local date is within [fromDate, toDate] (inclusive), with real UTC
 * instants computed per occurrence so DST shifts keep the wall-clock time.
 */
export function expandTemplate(t: TemplateRule, fromDate: string, toDate: string): Occurrence[] {
  const start = parseDate(t.startDate);
  const time = parseTime(t.startTime);
  const opts = RRule.parseString(t.rrule);
  // Floating time: UTC fields carry the local wall clock.
  const dtstart = new Date(Date.UTC(start.year, start.month - 1, start.day, time.hour, time.minute));
  const until = t.untilDate ? (() => { const u = parseDate(t.untilDate); return new Date(Date.UTC(u.year, u.month - 1, u.day, 23, 59)); })() : null;
  const rule = new RRule({ ...opts, dtstart, until });
  const from = parseDate(fromDate < t.startDate ? t.startDate : fromDate);
  const to = parseDate(toDate);
  const floating = rule.between(new Date(Date.UTC(from.year, from.month - 1, from.day, 0, 0)), new Date(Date.UTC(to.year, to.month - 1, to.day, 23, 59)), true);
  return floating.map((f) => {
    const startsAt = zonedWallTimeToUtc(
      { year: f.getUTCFullYear(), month: f.getUTCMonth() + 1, day: f.getUTCDate(), hour: f.getUTCHours(), minute: f.getUTCMinutes() },
      t.timeZone,
    );
    return { date: f.toISOString().slice(0, 10), startsAt, endsAt: new Date(startsAt.getTime() + t.durationMin * 60_000) };
  });
}

export interface ScheduleException {
  date: string;
  kind: "cancel" | "modify";
  overrides?: { startTime?: string; durationMin?: number; capacity?: number | null; instructorIds?: string[]; room?: string | null };
  reason?: string | null;
}

export interface PlannedSession extends Occurrence {
  status: "scheduled" | "cancelled";
  reason: string | null;
  overrides: NonNullable<ScheduleException["overrides"]>;
}

/**
 * Apply exceptions (cancel → cancelled session kept for notifications; modify → overrides) and
 * holidays (the occurrence is dropped entirely).
 */
export function planSessions(t: TemplateRule, occurrences: Occurrence[], exceptions: readonly ScheduleException[], holidayDates: ReadonlySet<string>): PlannedSession[] {
  const byDate = new Map(exceptions.map((e) => [e.date, e]));
  return occurrences
    .filter((o) => !holidayDates.has(o.date))
    .map((o) => {
      const ex = byDate.get(o.date);
      if (!ex) return { ...o, status: "scheduled" as const, reason: null, overrides: {} };
      if (ex.kind === "cancel") return { ...o, status: "cancelled" as const, reason: ex.reason ?? null, overrides: {} };
      const ov = ex.overrides ?? {};
      let { startsAt, endsAt } = o;
      if (ov.startTime) {
        const d = parseDate(o.date);
        const tm = parseTime(ov.startTime);
        startsAt = zonedWallTimeToUtc({ ...d, hour: tm.hour, minute: tm.minute }, t.timeZone);
      }
      const dur = ov.durationMin ?? t.durationMin;
      endsAt = new Date(startsAt.getTime() + dur * 60_000);
      return { ...o, startsAt, endsAt, status: "scheduled" as const, reason: ex.reason ?? null, overrides: ov };
    });
}

/** The materialisation window: today (local) … today + days. */
export function windowFor(now: Date, tz: string, days: number, back = 0): { from: string; to: string } {
  const today = localDate(now, tz);
  return { from: addDays(today, -back), to: addDays(today, days) };
}
export * from "./cron";
