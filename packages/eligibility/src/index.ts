/**
 * Rank-eligibility engine (F4.2). Pure: no I/O, no clock — callers pass counts and dates.
 *
 *   eligible — every requirement for the next rank is met
 *   almost   — only small gaps remain (see thresholds); the testing roster lists these with their gaps
 *   not_yet  — anything else (including inactive enrollments and students already at the top rank)
 *
 * Stripes do not affect eligibility.
 */

export type EligibilityStatus = "eligible" | "almost" | "not_yet";

export type Gap =
  | { kind: "classes"; have: number; need: number; short: number }
  | { kind: "days"; have: number; need: number; short: number }
  | { kind: "skills"; missing: string[] }
  | { kind: "approval" }
  | { kind: "inactive" }
  | { kind: "no_next_rank" };

export interface Requirements {
  minClasses: number;
  minDays: number;
  requiredSkillIds: readonly string[];
  requiresApproval: boolean;
}

export interface EligibilityInput {
  enrollment: { status: "active" | "paused" | "ended"; hasNextRank: boolean };
  /** Requirements for the next rank; null = none configured (eligible once active with a next rank). */
  requirements: Requirements | null;
  /** Classes attended since the last promotion (or since enrollment). */
  attendanceCount: number;
  /** Whole days since the last promotion (or since enrollment). */
  daysSince: number;
  /** Skill ids signed off for this enrollment. */
  signoffs: readonly string[];
  /** Whether an instructor approved the student for the next rank. */
  approved: boolean;
}

export interface Thresholds {
  /** Max classes short to count as "almost": max(minClassesShort, ceil(fraction × need)). */
  classesShortMin: number;
  classesShortFraction: number;
  /** Max days short: max(daysShortMin, ceil(fraction × need)). */
  daysShortMin: number;
  daysShortFraction: number;
  /** Max missing required skills. */
  skillsMissing: number;
  /** Max number of distinct gaps. */
  maxGaps: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  classesShortMin: 2,
  classesShortFraction: 0.2,
  daysShortMin: 7,
  daysShortFraction: 0.15,
  skillsMissing: 1,
  maxGaps: 2,
};

export interface EligibilityResult {
  status: EligibilityStatus;
  gaps: Gap[];
}

export function evaluate(input: EligibilityInput, t: Thresholds = DEFAULT_THRESHOLDS): EligibilityResult {
  if (!input.enrollment.hasNextRank) return { status: "not_yet", gaps: [{ kind: "no_next_rank" }] };
  if (input.enrollment.status !== "active") return { status: "not_yet", gaps: [{ kind: "inactive" }] };
  const req = input.requirements;
  if (!req) return { status: "eligible", gaps: [] };

  const gaps: Gap[] = [];
  const classes = Math.max(0, Math.floor(input.attendanceCount));
  const days = Math.max(0, Math.floor(input.daysSince));
  if (classes < req.minClasses) gaps.push({ kind: "classes", have: classes, need: req.minClasses, short: req.minClasses - classes });
  if (days < req.minDays) gaps.push({ kind: "days", have: days, need: req.minDays, short: req.minDays - days });
  const signed = new Set(input.signoffs);
  const missing = [...new Set(req.requiredSkillIds)].filter((s) => !signed.has(s));
  if (missing.length > 0) gaps.push({ kind: "skills", missing });
  if (req.requiresApproval && !input.approved) gaps.push({ kind: "approval" });

  if (gaps.length === 0) return { status: "eligible", gaps };
  return { status: isSmall(gaps, t) ? "almost" : "not_yet", gaps };
}

function isSmall(gaps: Gap[], t: Thresholds): boolean {
  if (gaps.length > t.maxGaps) return false;
  return gaps.every((g) => {
    switch (g.kind) {
      case "classes":
        return g.short <= Math.max(t.classesShortMin, Math.ceil(g.need * t.classesShortFraction));
      case "days":
        return g.short <= Math.max(t.daysShortMin, Math.ceil(g.need * t.daysShortFraction));
      case "skills":
        return g.missing.length <= t.skillsMissing;
      case "approval":
        return true;
      default:
        return false;
    }
  });
}

/** Human-readable gap, e.g. "3 more classes", "12 more days", "2 skills to sign off". */
export function describeGap(g: Gap, skillName: (id: string) => string = (id) => id): string {
  switch (g.kind) {
    case "classes":
      return `${g.short} more class${g.short === 1 ? "" : "es"} (${g.have}/${g.need})`;
    case "days":
      return `${g.short} more day${g.short === 1 ? "" : "s"} (${g.have}/${g.need})`;
    case "skills":
      return g.missing.length === 1 ? `Sign off: ${skillName(g.missing[0] ?? "")}` : `${g.missing.length} skills to sign off`;
    case "approval":
      return "Instructor approval";
    case "inactive":
      return "Enrollment is not active";
    case "no_next_rank":
      return "Highest rank in this program";
  }
}
