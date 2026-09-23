/**
 * Drift Detector scoring (A3): a transparent, rule-based risk score from a student's recent behaviour. The
 * LLM only explains and drafts outreach; it never decides who is at risk.
 */
export interface DriftFeatures {
  /** Classes attended in the last 28 days. */
  recent4w: number;
  /** Classes attended in the 8 weeks before that (days 29–84). */
  prior8w: number;
  /** Days since the last class (null = never attended). */
  daysSinceLast: number | null;
  pastDueCents: number;
  tenureDays: number;
  /** Injury / behaviour / billing notes in the last 30 days. */
  concernNotes30d: number;
}

export type DriftFactor = "attendance_drop" | "absent" | "past_due" | "new_member" | "concern_notes";
export interface DriftReason { factor: DriftFactor; points: number; detail: string }
export interface DriftScore { score: number; level: "low" | "medium" | "high"; reasons: DriftReason[] }

const perWeek = (n: number, weeks: number) => Math.round((n / weeks) * 10) / 10;

export function scoreDrift(f: DriftFeatures, fmtMoney: (cents: number) => string = (c) => `$${(c / 100).toFixed(2)}`): DriftScore {
  const reasons: DriftReason[] = [];
  const recentRate = f.recent4w / 4;
  const priorRate = f.prior8w / 8;
  // A real habit (≥ 1 class/week before) that has fallen by a quarter or more.
  if (priorRate >= 1 && recentRate < priorRate * 0.75) {
    const drop = 1 - recentRate / priorRate;
    reasons.push({ factor: "attendance_drop", points: Math.min(40, Math.round(45 * drop)), detail: `Attendance fell from ${perWeek(f.prior8w, 8)} to ${perWeek(f.recent4w, 4)} classes a week` });
  }
  if (f.daysSinceLast !== null && f.daysSinceLast >= 7) {
    const pts = f.daysSinceLast >= 14 ? Math.min(40, 15 + (f.daysSinceLast - 14)) : 8;
    reasons.push({ factor: "absent", points: pts, detail: `No class in ${f.daysSinceLast} days` });
  }
  if (f.pastDueCents > 0) reasons.push({ factor: "past_due", points: f.pastDueCents >= 10_000 ? 20 : 15, detail: `Past-due balance ${fmtMoney(f.pastDueCents)}` });
  if (f.concernNotes30d > 0) reasons.push({ factor: "concern_notes", points: Math.min(20, 10 * f.concernNotes30d), detail: `${f.concernNotes30d} injury/behaviour/billing note${f.concernNotes30d === 1 ? "" : "s"} this month` });
  // Being new amplifies another signal; on its own it isn't a risk.
  if (f.tenureDays < 90 && reasons.length) reasons.push({ factor: "new_member", points: 10, detail: `Joined ${f.tenureDays} days ago` });
  const score = Math.min(100, reasons.reduce((a, r) => a + r.points, 0));
  reasons.sort((a, b) => b.points - a.points);
  return { score, level: score >= 50 ? "high" : score >= 25 ? "medium" : "low", reasons };
}
