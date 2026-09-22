import { describe, expect, it } from "vitest";
import { isDue, parseCron, previousRun } from "./cron";

describe("cron", () => {
  it("matches fields", () => {
    const c = parseCron("0 3 * * *");
    expect(c.matches(new Date("2026-09-22T03:00:00Z"))).toBe(true);
    expect(c.matches(new Date("2026-09-22T03:01:00Z"))).toBe(false);
    expect(parseCron("*/5 * * * *").matches(new Date("2026-09-22T10:25:00Z"))).toBe(true);
    expect(parseCron("*/5 * * * *").matches(new Date("2026-09-22T10:26:00Z"))).toBe(false);
    expect(parseCron("0 9 * * 1-5").matches(new Date("2026-09-26T09:00:00Z"))).toBe(false); // Saturday
    expect(parseCron("0 9 * * 1,3").matches(new Date("2026-09-23T09:00:00Z"))).toBe(true); // Wednesday
  });
  it("rejects malformed expressions", () => {
    expect(() => parseCron("0 3 * *")).toThrow();
    expect(() => parseCron("61 * * * *")).toThrow();
  });
  it("finds the previous run and due-ness", () => {
    const now = new Date("2026-09-22T10:07:30Z");
    expect(previousRun("0 3 * * *", now)?.toISOString()).toBe("2026-09-22T03:00:00.000Z");
    expect(isDue("0 3 * * *", now, null)).toBe(true);
    expect(isDue("0 3 * * *", now, new Date("2026-09-22T03:00:05Z"))).toBe(false);
    expect(isDue("0 3 * * *", now, new Date("2026-09-21T03:00:05Z"))).toBe(true);
    expect(isDue("*/5 * * * *", now, new Date("2026-09-22T10:04:00Z"))).toBe(true);
  });
});
