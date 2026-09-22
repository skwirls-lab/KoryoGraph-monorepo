import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { DateText } from "@koryo/ui/components/app/date-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ONBOARDING_STEPS, onboardingProgress, onboardingState } from "@/lib/onboarding";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const ctx = await requireSurfacePage("desk");
  const [{ data: tenant }, { data: ents }] = await Promise.all([
    ctx.supabase.from("tenants").select("name, status, trial_ends_at, onboarding").eq("id", ctx.tenantId).single(),
    ctx.supabase.from("tenant_entitlements").select("module_key, source, ends_at, modules(name, sort)").eq("tenant_id", ctx.tenantId),
  ]);
  const state = onboardingState.parse(tenant?.onboarding ?? {});
  const { done, total } = onboardingProgress(state.steps);
  const modules = (ents ?? []).slice().sort((a, b) => (a.modules?.sort ?? 0) - (b.modules?.sort ?? 0));

  return (
    <>
      <PageHeader
        eyebrow="Get started"
        title={`Welcome to ${tenant?.name ?? "your school"}`}
        description={`${done} of ${total} setup steps complete.`}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="steps" className="rounded-xl border border-default bg-surface p-4 sm:p-6">
          <h2 id="steps" className="sr-only">Setup steps</h2>
          <div
            className="mb-4 h-2 overflow-hidden rounded-full bg-elevated"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <div className="h-full bg-brand" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <ol className="divide-y divide-default">
            {ONBOARDING_STEPS.map((step) => {
              const complete = Boolean(state.steps[step.key]);
              return (
                <li key={step.key} className="flex items-start gap-3 py-3">
                  {complete ? (
                    <CheckCircle2 aria-label="Done" className="mt-0.5 size-5 shrink-0 text-success" />
                  ) : (
                    <Circle aria-label="Not done" className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {step.href ? <Link href={step.href}>{step.title}</Link> : step.title}
                    </div>
                    <p className="text-sm text-fg-secondary">{step.description}</p>
                    {!step.href ? <p className="text-xs text-fg-muted">This screen is built in milestone {step.milestone}.</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <aside className="space-y-3 rounded-xl border border-default bg-surface p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Your trial</h2>
          {tenant?.trial_ends_at ? (
            <p className="text-sm text-fg-secondary">
              Every module is enabled until <DateText value={tenant.trial_ends_at} timeZone={ctx.tz} />.
            </p>
          ) : null}
          <ul className="space-y-1 text-sm" aria-label="Enabled modules">
            {modules.map((m) => (
              <li key={m.module_key} className="flex justify-between gap-2">
                <span>{m.modules?.name ?? m.module_key}</span>
                <span className="text-fg-muted capitalize">{m.source}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
