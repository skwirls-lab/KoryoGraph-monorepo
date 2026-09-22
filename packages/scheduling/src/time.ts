/** Timezone helpers on Intl only (no tz database dependency). All instants are JS Dates (UTC). */

const partsFormatter = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatter.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    partsFormatter.set(tz, f);
  }
  return f;
}

export interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

/** The wall-clock time of an instant in a timezone. */
export function wallTimeOf(instant: Date, tz: string): WallTime & { second: number; weekday: number } {
  const p = Object.fromEntries(formatter(tz).formatToParts(instant).map((x) => [x.type, x.value]));
  const w = { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second) };
  const weekday = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();
  return { ...w, weekday };
}

/** Offset (ms) of tz from UTC at an instant: local = utc + offset. */
export function tzOffsetMs(instant: Date, tz: string): number {
  const w = wallTimeOf(instant, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `tz` reads `w`. DST gaps resolve forward (02:30 on a
 * spring-forward day → 03:30), overlaps resolve to the first occurrence.
 */
export function zonedWallTimeToUtc(w: WallTime, tz: string): Date {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const o1 = tzOffsetMs(new Date(guess), tz);
  let utc = guess - o1;
  const o2 = tzOffsetMs(new Date(utc), tz);
  if (o2 !== o1) utc = guess - o2;
  return new Date(utc);
}

/** YYYY-MM-DD of an instant in a timezone. */
export function localDate(instant: Date, tz: string): string {
  const w = wallTimeOf(instant, tz);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

export function parseDate(d: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Invalid date ${d}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parseTime(t: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) throw new Error(`Invalid time ${t}`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}
