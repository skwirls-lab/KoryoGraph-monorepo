/** Shared people vocabulary (client + server). */
export const PERSON_STATUSES = ["lead", "trial", "active", "on_hold", "cancelled", "alumni", "staff", "guardian_only"] as const;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

export const STATUS_LABELS: Record<PersonStatus, string> = {
  lead: "Lead",
  trial: "Trial",
  active: "Active",
  on_hold: "On hold",
  cancelled: "Cancelled",
  alumni: "Alumni",
  staff: "Staff",
  guardian_only: "Guardian",
};

export const CONSENT_KINDS = ["media_release", "ai_processing", "messaging", "photo"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];
export const CONSENT_LABELS: Record<ConsentKind, string> = {
  media_release: "Media release",
  ai_processing: "AI processing of class audio/video",
  messaging: "Messaging",
  photo: "Photos on profile",
};

export const NOTE_KINDS = ["general", "injury", "behavior", "progress", "billing", "follow_up"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export function displayName(p: { first_name: string; last_name: string; preferred_name?: string | null }): string {
  return `${p.preferred_name || p.first_name} ${p.last_name}`.trim();
}

/** Whole years between dob (YYYY-MM-DD) and `on` (YYYY-MM-DD). */
export function ageOn(dob: string, on: string): number {
  const [by, bm, bd] = dob.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function isMinor(dob: string | null | undefined, today: string): boolean {
  return Boolean(dob) && ageOn(dob as string, today) < 18;
}

/** Today's date (YYYY-MM-DD) in a timezone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
