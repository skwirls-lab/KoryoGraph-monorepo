import { describe, expect, it } from "vitest";
import { scoreLead } from "./tasks/growth";

const base = { stage: "new", source: null, hasMessage: false, daysOld: 2, activities: 1, trialBooked: false, trialAttended: false, lastTouchDays: 1 };

describe("scoreLead", () => {
  it("rewards trials, referrals and engagement; penalises staleness; stays within 0–100", () => {
    expect(scoreLead(base).score).toBe(20);
    expect(scoreLead({ ...base, trialAttended: true, source: "referral", stage: "offer", hasMessage: true, activities: 4 }).score).toBe(95);
    expect(scoreLead({ ...base, trialBooked: true }).reasons).toEqual(["trial booked"]);
    expect(scoreLead({ ...base, lastTouchDays: 30, daysOld: 60 }).score).toBe(0);
    expect(scoreLead({ ...base, trialAttended: true, trialBooked: true }).reasons).toEqual(["attended a trial"]);
  });
});
