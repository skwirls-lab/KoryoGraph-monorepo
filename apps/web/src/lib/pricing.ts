export type Cycle = "monthly" | "annual";
export interface PriceModule { key: string; name: string; description: string; required: boolean; monthlyCents: number; annualCents: number; note: string }
export interface PricePlan { key: string; name: string; description: string; monthlyCents: number; annualCents: number; modules: string[] }

export const price = (x: { monthlyCents: number; annualCents: number }, cycle: Cycle) => (cycle === "monthly" ? x.monthlyCents : x.annualCents);
export const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/**
 * Module picker total: required modules are always included; multi-location is per additional location.
 * Also the cheapest bundle that covers the same modules, if it costs less than the sum.
 */
export function quote(modules: PriceModule[], plans: PricePlan[], selected: string[], cycle: Cycle, extraLocations = 0): {
  keys: string[]; lines: { key: string; name: string; cents: number }[]; totalCents: number; bundle: { key: string; name: string; cents: number; savesCents: number } | null;
} {
  const keys = modules.filter((m) => m.required || selected.includes(m.key)).map((m) => m.key);
  const lines = modules.filter((m) => keys.includes(m.key)).map((m) => ({
    key: m.key, name: m.key === "multi_location" ? `${m.name} × ${Math.max(1, extraLocations)}` : m.name,
    cents: price(m, cycle) * (m.key === "multi_location" ? Math.max(1, extraLocations) : 1),
  }));
  const totalCents = lines.reduce((a, l) => a + l.cents, 0);
  const extra = lines.find((l) => l.key === "multi_location")?.cents ?? 0;
  const covering = plans
    .filter((p) => keys.filter((k) => k !== "multi_location").every((k) => p.modules.includes(k)))
    .map((p) => ({ key: p.key, name: p.name, cents: price(p, cycle) + extra }))
    .sort((a, b) => a.cents - b.cents)[0];
  const bundle = covering && covering.cents < totalCents ? { ...covering, savesCents: totalCents - covering.cents } : null;
  return { keys, lines, totalCents, bundle };
}
