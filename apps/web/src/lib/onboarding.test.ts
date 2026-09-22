import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, onboardingProgress, onboardingState } from "./onboarding";

describe("onboarding", () => {
  it("counts completed steps", () => {
    expect(onboardingProgress({ location: true, programs: true, unknown: true })).toEqual({ done: 2, total: ONBOARDING_STEPS.length });
  });
  it("tolerates malformed stored state", () => {
    expect(onboardingState.parse("garbage")).toEqual({ steps: {}, dismissed: false });
    expect(onboardingState.parse({ steps: { location: true } })).toEqual({ steps: { location: true }, dismissed: false });
  });
});
