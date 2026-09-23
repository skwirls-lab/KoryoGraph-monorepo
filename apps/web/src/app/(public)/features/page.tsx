import Link from "next/link";
import { Button } from "@koryo/ui/components/ui/button";
import { SiteShell } from "@/components/site/site-shell";
import { loadPricing } from "@/server/queries/pricing";

export const metadata = {
  title: "Features",
  description: "People and households, billing and dunning, attendance and ranks, events and retail, a family app, and AI agents that draft for staff approval.",
  alternates: { canonical: "/features" },
};

// What each module does in practice (the module list and prices come from the database).
const DETAIL: Record<string, string[]> = {
  core: ["Households with guardians, students and consents", "Programs, rank ladders, requirements and skill sign-offs", "Weekly schedules, rosters, kiosk check-in with PINs", "Staff roles and permissions, audit log", "Messaging outbox with quiet hours and consent", "Standard reports and a full data export"],
  billing: ["Membership plans, contracts, family discounts", "Invoices, autopay through Stripe, card on file", "Dunning with retries and reminders", "Accounts-receivable aging and revenue reports", "Home wallet for families"],
  retail: ["Products, sizes and stock by location", "Point of sale with cash drawer and card readers", "Purchase orders and receiving"],
  grow: ["Lead pipeline with trial booking", "Public trial form and booking widget", "Automations and broadcasts", "Trial funnel and retention reports"],
  programs_plus: ["Camps and events with day passes and waivers", "After-school program with pickup manifests", "Birthday parties with guest waivers"],
  home: ["Schedule and class booking", "Progress toward the next belt", "Invoices, payments and forms to sign", "Messages from the school"],
  intelligence: ["Copilot over your school's data, with sources", "Drift Detector for students who are slipping", "Action Board from a class recording or notes", "Lesson builder, packing-slip intake, reports in plain English", "Billing follow-ups and weekly parent updates — all drafts for staff approval"],
  vision: ["Students send a short practice clip", "Rubric-based feedback with three tips", "An instructor reviews before the student sees it"],
  multi_location: ["Location switcher and per-location staff", "Rollups across locations"],
};

export default async function Features() {
  const { modules } = await loadPricing();
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h1 className="text-4xl font-bold">Features</h1>
        <p className="mt-3 max-w-2xl text-lg text-fg-secondary">KoryoGraph is built from modules. Core runs the school; add the rest as you need them.</p>
        <ul className="mt-10 grid gap-4 md:grid-cols-2" aria-label="Modules">
          {modules.map((m) => (
            <li key={m.key} id={m.key} className="rounded-xl border border-default bg-surface p-5">
              <h2 className="text-lg font-semibold">{m.name}{m.required ? <span className="ml-2 text-xs font-normal text-fg-muted">included in every plan</span> : null}</h2>
              <p className="mt-1 text-sm text-fg-secondary">{m.description}</p>
              {DETAIL[m.key] ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{DETAIL[m.key]?.map((d) => <li key={d}>{d}</li>)}</ul> : null}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/signup">Start free trial</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/pricing">See pricing</Link></Button>
        </div>
      </section>
    </SiteShell>
  );
}
