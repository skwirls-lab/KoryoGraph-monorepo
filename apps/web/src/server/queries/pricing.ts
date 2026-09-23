import "server-only";
import { createAnonClient } from "@koryo/db/anon";
import type { PriceModule, PricePlan } from "@/lib/pricing";

/** Public plans and modules (anon-readable) for the landing page and /pricing. */
export async function loadPricing(): Promise<{ modules: PriceModule[]; plans: PricePlan[] }> {
  const db = createAnonClient();
  const [{ data: modules, error: me }, { data: plans, error: pe }] = await Promise.all([
    db.from("modules").select("key, name, description, required, monthly_cents, annual_cents, price_note, sort").order("sort"),
    db.from("plans").select("key, name, description, monthly_cents, annual_cents, sort, plan_modules(module_key)").eq("public", true).order("sort"),
  ]);
  if (me || pe) throw new Error(`pricing: ${me?.message ?? pe?.message}`);
  return {
    modules: (modules ?? []).map((m) => ({ key: m.key, name: m.name, description: m.description, required: m.required, monthlyCents: m.monthly_cents, annualCents: m.annual_cents, note: m.price_note })),
    plans: (plans ?? []).map((p) => ({ key: p.key, name: p.name, description: p.description, monthlyCents: p.monthly_cents, annualCents: p.annual_cents, modules: (p.plan_modules ?? []).map((x) => x.module_key) })),
  };
}
