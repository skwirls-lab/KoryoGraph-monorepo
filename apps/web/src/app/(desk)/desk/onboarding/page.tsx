import { CheckCircle2, Circle, CircleDashed } from "lucide-react";
import Link from "next/link";
import { DateText } from "@koryo/ui/components/app/date-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { requireSurfacePage } from "@/server/context";
import { onboardingStatus } from "@/server/queries/onboarding";

export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const ctx = await requireSurfacePage("desk");
  const [s, { data: ents }] = await Promise.all([
    onboardingStatus(ctx),
    ctx.supabase.from("tenant_entitlements").select("module_key, source, ends_at, modules(name, sort)").eq("tenant_id", ctx.tenantId as string),
  ]);
  const now = new Date().toISOString();
  const modules = (ents ?? []).filter((m) => !m.ends_at || m.ends_at > now).sort((a, b) => (a.modules?.sort ?? 0) - (b.modules?.sort ?? 0));
  const next = s.steps.find((x) => !x.done);
  return (
    <>
      <PageHeader eyebrow="Get started" title={`Welcome to ${ctx.tenantName ?? "your school"}`} description={`${s.done} of ${s.total} steps done.`}
        actions={next ? <Button asChild><Link href={`/desk/onboarding/${next.key}`}>{s.done ? "Continue" : "Start"}</Link></Button> : undefined} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="steps-h" className="rounded-xl border border-default bg-surface p-4 sm:p-6">
          <h2 id="steps-h" className="sr-only">Setup steps</h2>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={s.total} aria-valuenow={s.done}>
            <div className="h-full bg-brand" style={{ width: `${(s.done / s.total) * 100}%` }} />
          </div>
          <ol className="divide-y divide-default" aria-label="Steps">
            {ONBOARDING_STEPS.map((step, i) => {
              const st = s.steps[i];
              return (
                <li key={step.key} aria-label={step.title} className="flex items-start gap-3 py-3">
                  {st?.done && !st.skipped ? <CheckCircle2 aria-label="Done" className="mt-0.5 size-5 shrink-0 text-success" />
                    : st?.skipped ? <CircleDashed aria-label="Skipped" className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                    : <Circle aria-label="Not done" className="mt-0.5 size-5 shrink-0 text-fg-muted" />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/desk/onboarding/${step.key}`} className="font-medium">{step.title}</Link>
                    <p className="text-sm text-fg-secondary">{step.description}</p>
                  </div>
                  <span className="text-right text-xs text-fg-muted">{st?.skipped ? "Skipped · " : ""}{st?.detail}</span>
                </li>
              );
            })}
          </ol>
        </section>
        <aside className="space-y-2 rounded-xl border border-default bg-surface p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{s.live ? "You're live" : "Your trial"}</h2>
          {s.live ? <p className="text-sm text-fg-secondary">Your plan is active.</p>
            : s.trialEndsAt ? <p className="text-sm text-fg-secondary">Every module is on until <DateText value={s.trialEndsAt} timeZone={ctx.tz} />. Choose a plan in the last step.</p> : null}
          <ul className="space-y-1 text-sm" aria-label="Enabled modules">
            {modules.map((m) => <li key={m.module_key} className="flex justify-between gap-2"><span>{m.modules?.name ?? m.module_key}</span><span className="capitalize text-fg-muted">{m.source}</span></li>)}
          </ul>
        </aside>
      </div>
    </>
  );
}
