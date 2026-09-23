export interface ClassStats {
  template_id: string;
  name: string;
  weekday: string;
  start_time: string;
  program_ids: string[];
  sessions: number;
  capacity: number | null;
  avg_attended: number;
  avg_booked: number;
  avg_waitlisted: number;
  no_show_rate: number;
}

export type SuggestionKind = "add_section" | "merge" | "move" | "no_show";
export interface Candidate {
  kind: SuggestionKind;
  stats: ClassStats;
  utilization: number;
  other: ClassStats | null;
  /** Higher = more worth the owner's attention. */
  weight: number;
}

export const utilization = (s: ClassStats) => (s.capacity ? Math.max(s.avg_attended, s.avg_booked) / s.capacity : 0);

/**
 * What's worth looking at in the timetable, from the last few weeks' numbers:
 * nearly full or waitlisted → add a section; nearly empty → merge into a related class with room (same
 * name or program), or move it; lots of no-shows on booked classes → tighten reminders/cancellation.
 */
export function scheduleCandidates(all: ClassStats[], max = 5): Candidate[] {
  const out: Candidate[] = [];
  const usable = all.filter((s) => s.sessions >= 2 && s.capacity);
  const baseName = (n: string) => n.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
  for (const s of usable) {
    const u = utilization(s);
    if (u >= 0.9 || s.avg_waitlisted >= 2) {
      out.push({ kind: "add_section", stats: s, utilization: u, other: null, weight: u + s.avg_waitlisted / 5 });
    } else if (u <= 0.25) {
      const partners = usable.filter((o) => o.template_id !== s.template_id && utilization(o) < 0.7
        && (baseName(o.name) === baseName(s.name) || o.program_ids.some((p) => s.program_ids.includes(p))));
      partners.sort((a, b) => Number(baseName(b.name) === baseName(s.name)) - Number(baseName(a.name) === baseName(s.name)) || utilization(b) - utilization(a));
      const other = partners[0] ?? null;
      out.push({ kind: other ? "merge" : "move", stats: s, utilization: u, other, weight: 1 - u });
    }
    if (s.no_show_rate >= 0.2 && s.avg_booked >= 3) out.push({ kind: "no_show", stats: s, utilization: u, other: null, weight: s.no_show_rate });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, max);
}

/** Fill a suggestion's placeholders with the real numbers. */
export function fillSuggestion(text: string, c: Candidate): string {
  const s = c.stats;
  return text
    .replaceAll("{{class}}", s.name).replaceAll("{{day}}", s.weekday).replaceAll("{{time}}", s.start_time)
    .replaceAll("{{utilization}}", `${Math.round(c.utilization * 100)}%`).replaceAll("{{waitlist}}", s.avg_waitlisted.toFixed(1))
    .replaceAll("{{no_show}}", `${Math.round(s.no_show_rate * 100)}%`)
    .replaceAll("{{other_class}}", c.other ? `${c.other.name} (${c.other.weekday} ${c.other.start_time})` : "another class");
}

/** Plain wording used when AI isn't available (the numbers are the same). */
export const PLAIN: Record<SuggestionKind, { title: string; rationale: string }> = {
  add_section: { title: "Add a section of {{class}}", rationale: "{{class}} ({{day}} {{time}}) has been {{utilization}} full on average over the last 4 weeks." },
  merge: { title: "Merge the {{day}} {{class}} into {{other_class}}", rationale: "{{class}} ({{day}} {{time}}) has averaged {{utilization}} of capacity over the last 4 weeks; {{other_class}} has room." },
  move: { title: "Rethink the {{day}} {{time}} {{class}}", rationale: "{{class}} has averaged {{utilization}} of capacity over the last 4 weeks; a different day or time may suit families better." },
  no_show: { title: "Cut no-shows in {{class}}", rationale: "{{no_show}} of bookings for {{class}} ({{day}} {{time}}) were no-shows over the last 4 weeks; reminders or a tighter cancellation window may help." },
};
