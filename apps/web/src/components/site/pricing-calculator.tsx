"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { dollars, price, quote, type Cycle, type PriceModule, type PricePlan } from "@/lib/pricing";

export function PricingCalculator({ modules, plans }: { modules: PriceModule[]; plans: PricePlan[] }) {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [selected, setSelected] = useState<string[]>(["billing", "home"]);
  const [locations, setLocations] = useState(1);
  const q = quote(modules, plans, selected, cycle, locations);
  const per = cycle === "monthly" ? "/month" : "/year";
  return (
    <div className="space-y-10">
      <fieldset className="inline-flex rounded-lg border border-default p-1" aria-label="Billing cycle">
        {(["monthly", "annual"] as const).map((c) => (
          <label key={c} className={`cursor-pointer rounded-md px-3 py-1.5 text-sm ${cycle === c ? "bg-brand text-brand-foreground" : ""}`}>
            <input type="radio" name="cycle" value={c} checked={cycle === c} onChange={() => setCycle(c)} className="sr-only" />
            {c === "monthly" ? "Monthly" : "Annual (2 months free)"}
          </label>
        ))}
      </fieldset>

      <section aria-labelledby="plans-h">
        <h2 id="plans-h" className="text-2xl font-bold">Plans</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Plans">
          {plans.map((p) => (
            <li key={p.key} aria-label={p.name} className="flex flex-col rounded-xl border border-default bg-surface p-5">
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-2"><span className="text-3xl font-bold tabular" data-testid={`plan-price-${p.key}`}>{dollars(price(p, cycle))}</span><span className="text-fg-muted">{per}</span></p>
              <p className="mt-2 text-sm text-fg-secondary">{p.description}</p>
              <ul className="mt-3 flex-1 space-y-1 text-sm">{p.modules.map((k) => <li key={k}>✓ {modules.find((m) => m.key === k)?.name ?? k}</li>)}</ul>
              <Button asChild className="mt-4"><Link href={`/signup?plan=${p.key}`}>Start with {p.name}</Link></Button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="build-h" className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 id="build-h" className="text-2xl font-bold">Or build your own</h2>
          <ul className="mt-4 divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Modules">
            {modules.map((m) => (
              <li key={m.key} className="flex flex-wrap items-start gap-3 p-4">
                <input id={`mod-${m.key}`} type="checkbox" className="mt-1 accent-[var(--color-primary)]" checked={m.required || selected.includes(m.key)} disabled={m.required}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, m.key] : s.filter((x) => x !== m.key)))} />
                <label htmlFor={`mod-${m.key}`} className="min-w-0 flex-1">
                  <span className="font-medium">{m.name}</span>{m.required ? <span className="text-fg-muted"> (required)</span> : null}
                  <span className="block text-sm text-fg-secondary">{m.description}</span>
                </label>
                <span className="text-sm tabular">{m.required ? "" : "+"}{dollars(price(m, cycle))}{per}{m.note ? <span className="block text-xs text-fg-muted">{m.note}</span> : null}</span>
                {m.key === "multi_location" && selected.includes(m.key) ? (
                  <label className="flex w-full items-center gap-2 pl-7 text-sm">Additional locations
                    <input type="number" min={1} max={50} value={locations} onChange={(e) => setLocations(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="h-8 w-20 rounded-md border border-default bg-background px-2" />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <aside aria-labelledby="total-h" className="h-fit rounded-xl border border-default bg-surface p-5 lg:sticky lg:top-4">
          <h3 id="total-h" className="font-semibold">Your total</h3>
          <ul className="mt-3 space-y-1 text-sm" aria-label="Selected modules">{q.lines.map((l) => <li key={l.key} className="flex justify-between gap-2"><span>{l.name}</span><span className="tabular">{dollars(l.cents)}</span></li>)}</ul>
          <p className="mt-3 flex items-baseline justify-between border-t border-default pt-3"><span>Total</span><span className="text-2xl font-bold tabular" data-testid="pricing-total">{dollars(q.totalCents)}<span className="text-sm font-normal text-fg-muted">{per}</span></span></p>
          {q.bundle ? <p className="mt-2 text-sm text-success" role="status">{q.bundle.name} covers these for {dollars(q.bundle.cents)}{per} — {dollars(q.bundle.savesCents)} less.</p> : null}
          {q.keys.some((k) => k === "intelligence" || k === "vision") ? <p className="mt-2 text-xs text-fg-muted">AI usage is metered against a monthly budget you set.</p> : null}
          <Button asChild className="mt-4 w-full"><Link href={`/signup?plan=${q.bundle?.key ?? "custom"}`}>Start free trial</Link></Button>
        </aside>
      </section>
    </div>
  );
}
