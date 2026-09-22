/**
 * Delivery policy (F10.4): consent per channel, a usable address, and TCPA quiet hours for SMS in the
 * tenant's timezone. Pure — callers pass `now`.
 */
export type Decision = { action: "send" } | { action: "opted_out" } | { action: "no_address" } | { action: "defer"; until: Date };

export interface QuietHours {
  /** Local HH:MM when quiet hours begin (e.g. "21:00"). */
  start: string;
  /** Local HH:MM when they end (e.g. "08:00"). */
  end: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = { start: "21:00", end: "08:00" };

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function localMinutes(now: Date, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  return Number(p.hour) * 60 + Number(p.minute);
}

export function inQuietHours(now: Date, tz: string, q: QuietHours): boolean {
  const cur = localMinutes(now, tz);
  const s = minutesOf(q.start);
  const e = minutesOf(q.end);
  return s === e ? false : s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

/** The next instant quiet hours end (for deferral). */
export function quietHoursEnd(now: Date, tz: string, q: QuietHours): Date {
  const cur = localMinutes(now, tz);
  const e = minutesOf(q.end);
  const delta = (e - cur + 1440) % 1440 || 1440;
  const t = new Date(now.getTime() + delta * 60_000);
  t.setUTCSeconds(0, 0);
  return t;
}

export function decide(input: {
  channel: "email" | "sms" | "inapp" | "push";
  address: string | null | undefined;
  consent: { email: boolean; sms: boolean };
  now: Date;
  timeZone: string;
  quietHours?: QuietHours;
  /** Transactional safety notices (e.g. class cancelled) still respect consent and quiet hours. */
}): Decision {
  if (input.channel === "inapp") return { action: "send" };
  if (!input.address) return { action: "no_address" };
  if (input.channel === "email" && !input.consent.email) return { action: "opted_out" };
  if (input.channel === "sms" && !input.consent.sms) return { action: "opted_out" };
  if (input.channel === "sms" && inQuietHours(input.now, input.timeZone, input.quietHours ?? DEFAULT_QUIET_HOURS)) {
    return { action: "defer", until: quietHoursEnd(input.now, input.timeZone, input.quietHours ?? DEFAULT_QUIET_HOURS) };
  }
  return { action: "send" };
}
