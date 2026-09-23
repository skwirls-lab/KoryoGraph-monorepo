import { describe, expect, it } from "vitest";
import { scoreDrift, type DriftFeatures } from "./drift";

const base: DriftFeatures = { recent4w: 8, prior8w: 16, daysSinceLast: 2, pastDueCents: 0, tenureDays: 400, concernNotes30d: 0 };

describe("scoreDrift", () => {
  it("a steady student is low risk with no reasons", () => {
    expect(scoreDrift(base)).toEqual({ score: 0, level: "low", reasons: [] });
  });
  it("a decaying student (2/wk → 0.5/wk, 16 days away) is high risk, biggest reason first", () => {
    const s = scoreDrift({ ...base, recent4w: 2, prior8w: 16, daysSinceLast: 16 });
    expect(s.level).toBe("high");
    expect(s.reasons.map((r) => r.factor)).toEqual(["attendance_drop", "absent"]);
    expect(s.reasons[0]?.detail).toBe("Attendance fell from 2 to 0.5 classes a week");
    expect(s.score).toBe(34 + 17);
  });
  it("no drop flagged without a prior habit; small dips are ignored", () => {
    expect(scoreDrift({ ...base, recent4w: 0, prior8w: 4, daysSinceLast: 3 }).reasons).toEqual([]);
    expect(scoreDrift({ ...base, recent4w: 7, prior8w: 16 }).reasons).toEqual([]);
  });
  it("absence tiers, caps and the 100 ceiling", () => {
    expect(scoreDrift({ ...base, daysSinceLast: 8 }).reasons[0]).toMatchObject({ factor: "absent", points: 8 });
    expect(scoreDrift({ ...base, daysSinceLast: 200 }).reasons[0]?.points).toBe(40);
    const worst = scoreDrift({ recent4w: 0, prior8w: 24, daysSinceLast: 90, pastDueCents: 50_000, tenureDays: 30, concernNotes30d: 5 });
    expect(worst.score).toBe(100);
    expect(worst.level).toBe("high");
  });
  it("past due and notes; 'new member' only adds to another signal", () => {
    expect(scoreDrift({ ...base, pastDueCents: 5000 }).reasons).toEqual([{ factor: "past_due", points: 15, detail: "Past-due balance $50.00" }]);
    expect(scoreDrift({ ...base, pastDueCents: 20_000 }).reasons[0]?.points).toBe(20);
    expect(scoreDrift({ ...base, tenureDays: 20 }).reasons).toEqual([]);
    expect(scoreDrift({ ...base, tenureDays: 20, concernNotes30d: 1 }).reasons.map((r) => r.factor)).toEqual(["concern_notes", "new_member"]);
    expect(scoreDrift({ ...base, daysSinceLast: null }).reasons).toEqual([]);
  });
});
