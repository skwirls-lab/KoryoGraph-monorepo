import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS, describeGap, evaluate, type EligibilityInput, type Requirements } from "./index";

const REQ: Requirements = { minClasses: 20, minDays: 60, requiredSkillIds: ["kick", "form", "count"], requiresApproval: false };
const base: EligibilityInput = {
  enrollment: { status: "active", hasNextRank: true },
  requirements: REQ,
  attendanceCount: 20,
  daysSince: 60,
  signoffs: ["kick", "form", "count"],
  approved: false,
};
const make = (patch: Partial<EligibilityInput>): EligibilityInput => ({ ...base, ...patch });

const cases: { name: string; input: EligibilityInput; status: string; kinds: string[] }[] = [
  { name: "all requirements met exactly", input: base, status: "eligible", kinds: [] },
  { name: "exceeds every requirement", input: make({ attendanceCount: 45, daysSince: 200 }), status: "eligible", kinds: [] },
  { name: "no requirements configured", input: make({ requirements: null, attendanceCount: 0, daysSince: 0, signoffs: [] }), status: "eligible", kinds: [] },
  { name: "zero-valued requirements", input: make({ requirements: { minClasses: 0, minDays: 0, requiredSkillIds: [], requiresApproval: false }, attendanceCount: 0, daysSince: 0 }), status: "eligible", kinds: [] },
  { name: "top of the ladder", input: make({ enrollment: { status: "active", hasNextRank: false } }), status: "not_yet", kinds: ["no_next_rank"] },
  { name: "paused enrollment", input: make({ enrollment: { status: "paused", hasNextRank: true } }), status: "not_yet", kinds: ["inactive"] },
  { name: "ended enrollment", input: make({ enrollment: { status: "ended", hasNextRank: true } }), status: "not_yet", kinds: ["inactive"] },
  { name: "4 classes short of 20 (20% threshold)", input: make({ attendanceCount: 16 }), status: "almost", kinds: ["classes"] },
  { name: "5 classes short of 20 (over threshold)", input: make({ attendanceCount: 15 }), status: "not_yet", kinds: ["classes"] },
  { name: "2 classes short of 5 (minimum threshold of 2)", input: make({ requirements: { ...REQ, minClasses: 5 }, attendanceCount: 3 }), status: "almost", kinds: ["classes"] },
  { name: "9 days short of 60 (15% threshold)", input: make({ daysSince: 51 }), status: "almost", kinds: ["days"] },
  { name: "10 days short of 60", input: make({ daysSince: 50 }), status: "not_yet", kinds: ["days"] },
  { name: "one skill missing", input: make({ signoffs: ["kick", "form"] }), status: "almost", kinds: ["skills"] },
  { name: "two skills missing", input: make({ signoffs: ["kick"] }), status: "not_yet", kinds: ["skills"] },
  { name: "approval only", input: make({ requirements: { ...REQ, requiresApproval: true } }), status: "almost", kinds: ["approval"] },
  { name: "approval given", input: make({ requirements: { ...REQ, requiresApproval: true }, approved: true }), status: "eligible", kinds: [] },
  { name: "two small gaps", input: make({ attendanceCount: 18, signoffs: ["kick", "form"] }), status: "almost", kinds: ["classes", "skills"] },
  { name: "three small gaps exceed maxGaps", input: make({ attendanceCount: 18, daysSince: 55, signoffs: ["kick", "form"] }), status: "not_yet", kinds: ["classes", "days", "skills"] },
  { name: "stripes are irrelevant (not an input)", input: make({}), status: "eligible", kinds: [] },
  { name: "extra sign-offs don't matter", input: make({ signoffs: ["kick", "form", "count", "bonus"] }), status: "eligible", kinds: [] },
  { name: "duplicate required skill ids counted once", input: make({ requirements: { ...REQ, requiredSkillIds: ["kick", "kick"] }, signoffs: [] }), status: "almost", kinds: ["skills"] },
  { name: "negative/fractional counts are clamped", input: make({ attendanceCount: -3, daysSince: 59.9 }), status: "not_yet", kinds: ["classes", "days"] },
];

describe("evaluate", () => {
  it.each(cases)("$name → $status", ({ input, status, kinds }) => {
    const r = evaluate(input);
    expect(r.status).toBe(status);
    expect(r.gaps.map((g) => g.kind)).toEqual(kinds);
  });

  it("reports exact class and day shortfalls", () => {
    expect(evaluate(make({ attendanceCount: 17, daysSince: 55 })).gaps).toEqual([
      { kind: "classes", have: 17, need: 20, short: 3 },
      { kind: "days", have: 55, need: 60, short: 5 },
    ]);
  });

  it("lists exactly the missing skills", () => {
    expect(evaluate(make({ signoffs: ["form"] })).gaps).toEqual([{ kind: "skills", missing: ["kick", "count"] }]);
  });

  it("honours custom thresholds", () => {
    const strict = { ...DEFAULT_THRESHOLDS, classesShortMin: 0, classesShortFraction: 0 };
    expect(evaluate(make({ attendanceCount: 19 }), strict).status).toBe("not_yet");
  });
});

describe("describeGap", () => {
  it("renders readable gaps", () => {
    expect(describeGap({ kind: "classes", have: 17, need: 20, short: 3 })).toBe("3 more classes (17/20)");
    expect(describeGap({ kind: "days", have: 59, need: 60, short: 1 })).toBe("1 more day (59/60)");
    expect(describeGap({ kind: "skills", missing: ["k"] }, () => "Front kick")).toBe("Sign off: Front kick");
    expect(describeGap({ kind: "skills", missing: ["a", "b"] })).toBe("2 skills to sign off");
    expect(describeGap({ kind: "approval" })).toBe("Instructor approval");
  });
});
