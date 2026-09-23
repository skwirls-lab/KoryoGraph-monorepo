import Link from "next/link";
import { Bot, ClipboardCheck, FileText, LineChart, MessageSquareHeart, MonitorSmartphone, TabletSmartphone, UsersRound } from "lucide-react";
import { Button } from "@koryo/ui/components/ui/button";
import { SiteShell } from "@/components/site/site-shell";
import { dollars } from "@/lib/pricing";
import { loadPricing } from "@/server/queries/pricing";

export const metadata = {
  title: { absolute: "KoryoGraph — the operating system for martial arts schools" },
  description: "Front desk, mat and family app in one place, with AI that drafts and staff who approve. Billing, attendance, ranks, events, retail and more.",
  alternates: { canonical: "/" },
};

const SURFACES = [
  { icon: MonitorSmartphone, name: "Desk", text: "The front office: people and households, billing and dunning, POS, the lead pipeline, events, reports and settings." },
  { icon: TabletSmartphone, name: "Mat", text: "The instructor's tablet: tonight's roster, one-tap check-in, stripes and skill sign-offs, testing scoresheets, class recordings." },
  { icon: UsersRound, name: "Home", text: "The family app: schedule and booking, progress toward the next belt, invoices and wallet, forms to sign, messages from the school." },
];

const AI = [
  { icon: Bot, name: "Ask Copilot", text: "Ask about your school in plain English — “which families are past due and haven't trained in three weeks?” — and get answers from your real data, with the sources." },
  { icon: LineChart, name: "Drift Detector", text: "Each night it spots students whose attendance is slipping, explains why, and drafts a check-in for you to approve." },
  { icon: ClipboardCheck, name: "Action Board", text: "Record the class (or jot notes). You get a draft of check-ins, skill sign-offs, injury notes and follow-ups to approve in one go." },
  { icon: FileText, name: "Reports in plain English", text: "“Attendance by program, last 8 weeks” becomes a chart and a table you can save — read-only, over your school's data only." },
  { icon: MessageSquareHeart, name: "Parent updates", text: "A short weekly note for each family about their child's progress, written from attendance and sign-offs and approved by staff before it's sent." },
];

export default async function Landing() {
  const { plans } = await loadPricing();
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <p className="mb-3 text-sm font-medium text-brand-text">For taekwondo, karate, BJJ and kickboxing schools</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">The operating system for martial arts schools.</h1>
        <p className="mt-5 max-w-2xl text-lg text-fg-secondary">Run the front desk, the mat and the family app from one place — memberships and billing, attendance and belt progress, events and retail — with AI that does the drafting while your staff stay in charge.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/signup">Start a 14-day free trial</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/pricing">See pricing</Link></Button>
        </div>
        <p className="mt-3 text-sm text-fg-muted">Every module during the trial. No card needed.</p>
      </section>

      <section aria-labelledby="surfaces-h" className="border-y border-default bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="surfaces-h" className="text-2xl font-bold sm:text-3xl">Three surfaces, one school</h2>
          <p className="mt-2 max-w-2xl text-fg-secondary">Everyone sees the same live data, shaped for where they are.</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {SURFACES.map((s) => (
              <li key={s.name} className="rounded-xl border border-default bg-background p-5">
                <s.icon aria-hidden className="mb-3 size-6 text-brand-text" />
                <h3 className="text-lg font-semibold">{s.name}</h3>
                <p className="mt-1 text-sm text-fg-secondary">{s.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="ai-h" className="mx-auto max-w-6xl px-4 py-16">
        <h2 id="ai-h" className="text-2xl font-bold sm:text-3xl">AI that drafts. People who decide.</h2>
        <p className="mt-2 max-w-2xl text-fg-secondary">Nothing reaches a family, and no record changes, until someone on your team approves it. Every AI run is logged against a monthly budget you set.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI.map((a) => (
            <li key={a.name} className="rounded-xl border border-default bg-surface p-5">
              <a.icon aria-hidden className="mb-3 size-6 text-brand-text" />
              <h3 className="font-semibold">{a.name}</h3>
              <p className="mt-1 text-sm text-fg-secondary">{a.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm"><Link href="/features">Everything KoryoGraph does →</Link></p>
      </section>

      <section aria-labelledby="pricing-h" className="border-t border-default bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="pricing-h" className="text-2xl font-bold sm:text-3xl">Pay for the modules you use</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Plans">
            {plans.map((p) => (
              <li key={p.key} className="flex flex-col rounded-xl border border-default bg-background p-5">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-2"><span className="text-3xl font-bold tabular">{dollars(p.monthlyCents)}</span><span className="text-fg-muted">/month</span></p>
                <p className="mt-2 flex-1 text-sm text-fg-secondary">{p.description}</p>
                <Button asChild variant="outline" className="mt-4"><Link href={`/signup?plan=${p.key}`}>Start with {p.name}</Link></Button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm"><Link href="/pricing">Compare plans or build your own →</Link></p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">Bring your school over in an afternoon</h2>
        <p className="mx-auto mt-2 max-w-xl text-fg-secondary">Import your students from a spreadsheet or your current system, set up your programs and ranks, connect payments — and you&apos;re open.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild size="lg"><Link href="/signup">Start free trial</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/contact">Talk to us</Link></Button>
        </div>
      </section>
    </SiteShell>
  );
}
