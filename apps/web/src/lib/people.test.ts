import { describe, expect, it } from "vitest";
import { ageOn, displayName, isMinor, todayIn } from "./people";

describe("people helpers", () => {
  it("computes age with birthday boundaries", () => {
    expect(ageOn("2018-04-12", "2026-04-11")).toBe(7);
    expect(ageOn("2018-04-12", "2026-04-12")).toBe(8);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
  });
  it("flags minors", () => {
    expect(isMinor("2010-01-01", "2026-09-22")).toBe(true);
    expect(isMinor("2000-01-01", "2026-09-22")).toBe(false);
    expect(isMinor(null, "2026-09-22")).toBe(false);
  });
  it("prefers preferred names", () => {
    expect(displayName({ first_name: "Margaret", last_name: "Cooper", preferred_name: "Maggie" })).toBe("Maggie Cooper");
  });
  it("formats today in a timezone", () => {
    expect(todayIn("America/New_York", new Date("2026-09-23T02:00:00Z"))).toBe("2026-09-22");
    expect(todayIn("UTC", new Date("2026-09-23T02:00:00Z"))).toBe("2026-09-23");
  });
});
