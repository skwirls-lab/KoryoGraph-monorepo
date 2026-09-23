/** Calendar-date arithmetic on "YYYY-MM-DD" strings (UTC, no time zones — billing is by date). */
export type DateStr = string;

export function toUtc(d: DateStr): number {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day);
}

export function fromUtc(ms: number): DateStr {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysStr(d: DateStr, n: number): DateStr {
  return fromUtc(toUtc(d) + n * 86_400_000);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

/** Add calendar months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonthsStr(d: DateStr, n: number): DateStr {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm0 = total % 12;
  return fromUtc(Date.UTC(ny, nm0, Math.min(day, daysInMonth(ny, nm0))));
}
