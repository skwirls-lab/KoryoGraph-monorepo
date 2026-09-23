import { SiteShell } from "@/components/site/site-shell";
import { PricingCalculator } from "@/components/site/pricing-calculator";
import { loadPricing } from "@/server/queries/pricing";

export const metadata = {
  title: "Pricing",
  description: "Plans from Core to Academy AI, or pick the modules you need. Monthly or annual, 14-day free trial with every module.",
  alternates: { canonical: "/pricing" },
};

export default async function Pricing() {
  const { modules, plans } = await loadPricing();
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h1 className="text-4xl font-bold">Pricing</h1>
        <p className="mt-3 max-w-2xl text-lg text-fg-secondary">Every plan starts with a 14-day trial of every module — no card needed. Prices in US dollars, before tax.</p>
        <div className="mt-10"><PricingCalculator modules={modules} plans={plans} /></div>
      </section>
    </SiteShell>
  );
}
