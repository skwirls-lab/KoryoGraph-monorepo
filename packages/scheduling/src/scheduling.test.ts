import { describe, expect, it } from "vitest";
import { describeRule, expandTemplate, localDate, planSessions, weeklyDays, weeklyRule, zonedWallTimeToUtc } from "./index";

const base = { rrule: "FREQ=WEEKLY;BYDAY=MO,WE", startDate: "2026-10-05", startTime: "17:00", untilDate: "2026-11-01", durationMin: 60, timeZone: "America/New_York" };

describe("timezones", () => {
  it("converts wall time to UTC across DST", () => {
    expect(zonedWallTimeToUtc({ year: 2026, month: 10, day: 5, hour: 17, minute: 0 }, "America/New_York").toISOString()).toBe("2026-10-05T21:00:00.000Z");
    expect(zonedWallTimeToUtc({ year: 2026, month: 11, day: 2, hour: 17, minute: 0 }, "America/New_York").toISOString()).toBe("2026-11-02T22:00:00.000Z");
    expect(zonedWallTimeToUtc({ year: 2026, month: 7, day: 1, hour: 9, minute: 30 }, "UTC").toISOString()).toBe("2026-07-01T09:30:00.000Z");
  });
  it("resolves a spring-forward gap forward", () => {
    const d = zonedWallTimeToUtc({ year: 2027, month: 3, day: 14, hour: 2, minute: 30 }, "America/New_York");
    expect(localDate(d, "America/New_York")).toBe("2027-03-14");
  });
});

describe("expandTemplate", () => {
  it("weekly Mon/Wed 17:00 for 4 weeks → 8 sessions at 17:00 local", () => {
    const occ = expandTemplate(base, "2026-10-01", "2026-11-30");
    expect(occ).toHaveLength(8);
    expect(occ.map((o) => o.date)).toEqual(["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14", "2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28"]);
    expect(occ[0]?.startsAt.toISOString()).toBe("2026-10-05T21:00:00.000Z");
    expect(occ[0]?.endsAt.toISOString()).toBe("2026-10-05T22:00:00.000Z");
  });
  it("keeps the wall clock after DST ends", () => {
    const occ = expandTemplate({ ...base, untilDate: null }, "2026-11-02", "2026-11-02");
    expect(occ[0]?.startsAt.toISOString()).toBe("2026-11-02T22:00:00.000Z");
  });
  it("clips to the window and to the start date", () => {
    expect(expandTemplate(base, "2026-10-13", "2026-10-20").map((o) => o.date)).toEqual(["2026-10-14", "2026-10-19"]);
    expect(expandTemplate(base, "2026-09-01", "2026-10-06").map((o) => o.date)).toEqual(["2026-10-05"]);
  });
});

describe("planSessions", () => {
  const occ = expandTemplate(base, "2026-10-01", "2026-11-30");
  it("cancel keeps a cancelled session; holiday drops it; modify moves it", () => {
    const planned = planSessions(base, occ, [
      { date: "2026-10-07", kind: "cancel", reason: "Tournament" },
      { date: "2026-10-14", kind: "modify", overrides: { startTime: "18:00", durationMin: 90 } },
    ], new Set(["2026-10-12"]));
    expect(planned).toHaveLength(7);
    expect(planned.filter((p) => p.status === "cancelled").map((p) => p.date)).toEqual(["2026-10-07"]);
    const moved = planned.find((p) => p.date === "2026-10-14");
    expect(moved?.startsAt.toISOString()).toBe("2026-10-14T22:00:00.000Z");
    expect(moved?.endsAt.toISOString()).toBe("2026-10-14T23:30:00.000Z");
  });
});

describe("rules", () => {
  it("builds and reads weekly rules", () => {
    expect(weeklyRule(["WE", "MO"])).toBe("FREQ=WEEKLY;BYDAY=MO,WE");
    expect(weeklyRule(["SA"], 2)).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=SA");
    expect(weeklyDays("FREQ=WEEKLY;BYDAY=MO,WE")).toEqual(["MO", "WE"]);
    expect(() => weeklyRule([])).toThrow();
  });
  it("describes rules for people", () => {
    expect(describeRule("FREQ=WEEKLY;BYDAY=MO,WE", "17:00")).toBe("Mon, Wed at 5:00 PM");
    expect(describeRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=SA", "09:30")).toBe("Every 2 weeks on Sat at 9:30 AM");
  });
});
