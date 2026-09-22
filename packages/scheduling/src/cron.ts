/**
 * Minimal 5-field cron (minute hour day-of-month month day-of-week) evaluated in UTC — enough for job
 * schedules like "0 3 * * *" and "*\/5 * * * *". Supports *, n, a-b, a,b and step (/n).
 */
function field(expr: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of expr.split(",")) {
    const [range, stepStr] = part.split("/") as [string, string | undefined];
    const step = stepStr ? Number(stepStr) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad cron step in "${expr}"`);
    let lo = min;
    let hi = max;
    if (range !== "*") {
      const [a, b] = range.split("-");
      lo = Number(a);
      hi = b === undefined ? (stepStr ? max : lo) : Number(b);
    }
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < min || hi > max || lo > hi) throw new Error(`bad cron field "${expr}"`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export interface Cron {
  matches(d: Date): boolean;
}

export function parseCron(expr: string): Cron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron needs 5 fields: "${expr}"`);
  const [mi, h, dom, mo, dow] = parts as [string, string, string, string, string];
  const f = { mi: field(mi, 0, 59), h: field(h, 0, 23), dom: field(dom, 1, 31), mo: field(mo, 1, 12), dow: field(dow.replace(/7/g, "0"), 0, 6) };
  const domAny = dom === "*";
  const dowAny = dow === "*";
  return {
    matches(d) {
      if (!f.mi.has(d.getUTCMinutes()) || !f.h.has(d.getUTCHours()) || !f.mo.has(d.getUTCMonth() + 1)) return false;
      const domOk = f.dom.has(d.getUTCDate());
      const dowOk = f.dow.has(d.getUTCDay());
      // Standard cron: if both day fields are restricted, either may match.
      return domAny && dowAny ? true : domAny ? dowOk : dowAny ? domOk : domOk || dowOk;
    },
  };
}

/** Most recent scheduled instant ≤ now (scans back minute by minute, up to `maxDays`). */
export function previousRun(expr: string, now: Date, maxDays = 32): Date | null {
  const cron = parseCron(expr);
  const t = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  for (let i = 0; i < maxDays * 1440; i++) {
    if (cron.matches(t)) return t;
    t.setTime(t.getTime() - 60_000);
  }
  return null;
}

/** A job is due when its latest scheduled instant is after its last successful start. */
export function isDue(expr: string, now: Date, lastRunAt: Date | null): boolean {
  const prev = previousRun(expr, now);
  if (!prev) return false;
  return !lastRunAt || lastRunAt < prev;
}
