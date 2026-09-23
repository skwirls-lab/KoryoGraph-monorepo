import { describe, expect, it } from "vitest";
import { dollars, quote, type PriceModule, type PricePlan } from "./pricing";

const m = (key: string, monthly: number, required = false): PriceModule => ({ key, name: key, description: "", required, monthlyCents: monthly, annualCents: monthly * 10, note: "" });
const MODULES = [m("core", 7900, true), m("billing", 4000), m("home", 3000), m("retail", 3000), m("multi_location", 4900)];
const PLANS: PricePlan[] = [
  { key: "core", name: "Core", description: "", monthlyCents: 7900, annualCents: 79000, modules: ["core"] },
  { key: "studio", name: "Studio", description: "", monthlyCents: 14900, annualCents: 149000, modules: ["core", "billing", "home"] },
];

describe("quote", () => {
  it("always includes required modules and sums the rest", () => {
    const q = quote(MODULES, PLANS, ["retail"], "monthly");
    expect(q.keys).toEqual(["core", "retail"]);
    expect(q.totalCents).toBe(10900);
    expect(q.bundle).toBeNull();
  });
  it("points out a cheaper bundle covering the same modules", () => {
    const q = quote(MODULES, PLANS, ["billing", "home"], "monthly");
    expect(q.totalCents).toBe(14900);
    expect(q.bundle).toBeNull(); // same price is not a saving
    const a = quote(MODULES.map((x) => (x.key === "home" ? { ...x, monthlyCents: 4000 } : x)), PLANS, ["billing", "home"], "monthly");
    expect(a.bundle).toEqual({ key: "studio", name: "Studio", cents: 14900, savesCents: 1000 });
  });
  it("prices annual and per-location add-ons", () => {
    const q = quote(MODULES, PLANS, ["multi_location"], "annual", 2);
    expect(q.lines.at(-1)).toEqual({ key: "multi_location", name: "multi_location × 2", cents: 98000 });
    expect(q.totalCents).toBe(79000 + 98000);
  });
  it("formats dollars", () => {
    expect(dollars(29900)).toBe("$299");
    expect(dollars(299000)).toBe("$2,990");
    expect(dollars(1050)).toBe("$10.50");
  });
});
