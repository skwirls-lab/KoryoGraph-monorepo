import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { BrandingForm, GoLive, InviteForm, LocationForm, PresetPicker, QuickClass, SkipStep } from "@/components/onboarding/steps";
import { todayIn } from "@/lib/people";
import { ONBOARDING_STEPS, type OnboardingStepKey } from "@/lib/onboarding";
import { requireSurfacePage } from "@/server/context";
import { onboardingStatus } from "@/server/queries/onboarding";
import { loadPricing } from "@/server/queries/pricing";
import { loadShellData } from "@/server/queries/shell";

export default async function OnboardingStep({ params }: { params: Promise<{ step: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const { step } = await params;
  const idx = ONBOARDING_STEPS.findIndex((s) => s.key === step);
  if (idx < 0) notFound();
  const def = ONBOARDING_STEPS[idx] as (typeof ONBOARDING_STEPS)[number];
  const key = def.key as OnboardingStepKey;
  const status = await onboardingStatus(ctx);
  const st = status.steps[idx];
  const prev = ONBOARDING_STEPS[idx - 1];
  const next = ONBOARDING_STEPS[idx + 1];
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/onboarding">Get started · step {idx + 1} of {ONBOARDING_STEPS.length}</Link>} title={def.title} description={def.description} />
      <section aria-label={def.title} className="space-y-4 rounded-xl border border-default bg-surface p-4 sm:p-6">
        <p role="status" className={`text-sm ${st?.done && !st.skipped ? "text-success" : "text-fg-secondary"}`}>{st?.done && !st.skipped ? "✓ " : ""}{st?.skipped ? "Skipped — " : ""}{st?.detail}</p>
        <StepBody step={key} tenantId={ctx.tenantId as string} tz={ctx.tz} status={status} ctx={ctx} />
      </section>
      <nav aria-label="Steps" className="mt-4 flex flex-wrap items-center gap-2">
        {prev ? <Button asChild variant="outline"><Link href={`/desk/onboarding/${prev.key}`}>Back</Link></Button> : null}
        {key !== "golive" && !st?.done ? <SkipStep step={key} /> : null}
        <span className="flex-1" />
        {next ? <Button asChild><Link href={`/desk/onboarding/${next.key}`}>Next: {next.title}</Link></Button> : <Button asChild variant="outline"><Link href="/desk">Dashboard</Link></Button>}
      </nav>
    </>
  );
}

async function StepBody({ step, tenantId, tz, status, ctx }: { step: OnboardingStepKey; tenantId: string; tz: string; status: Awaited<ReturnType<typeof onboardingStatus>>; ctx: Awaited<ReturnType<typeof requireSurfacePage>> }) {
  switch (step) {
    case "location": {
      const { data: loc } = await ctx.supabase.from("locations").select("name, address, phone").eq("is_default", true).maybeSingle();
      const a = (loc?.address ?? {}) as Record<string, string | undefined>;
      return <LocationForm initial={{ name: loc?.name ?? "Main location", line1: a.line1 ?? "", line2: a.line2 ?? "", city: a.city ?? "", region: a.region ?? "", postalCode: a.postal_code ?? "", country: a.country ?? "US", phone: loc?.phone ?? "" }} />;
    }
    case "programs": {
      const { data: programs } = await ctx.supabase.from("programs").select("id, name, ranks(count)").eq("active", true).order("sort");
      return (
        <div className="space-y-4">
          {programs?.length ? <ul className="text-sm" aria-label="Your programs">{programs.map((p) => <li key={p.id}><Link href={`/desk/programs/${p.id}`}>{p.name}</Link> · {(p.ranks as unknown as { count: number }[])[0]?.count ?? 0} ranks</li>)}</ul> : null}
          <PresetPicker />
          <p className="text-sm text-fg-secondary">Or <Link href="/desk/programs">build a program from scratch</Link>. You can rename ranks, change colours and add requirements any time.</p>
        </div>
      );
    }
    case "schedule": {
      const [{ data: programs }, { data: loc }, { data: classes }] = await Promise.all([
        ctx.supabase.from("programs").select("id, name").eq("active", true).order("sort"),
        ctx.supabase.from("locations").select("id").eq("is_default", true).maybeSingle(),
        ctx.supabase.from("class_templates").select("id, name, rrule, start_time").eq("active", true).order("start_time"),
      ]);
      return (
        <div className="space-y-4">
          {classes?.length ? <ul className="text-sm" aria-label="Your classes">{classes.map((c) => <li key={c.id}>{c.name} · {c.rrule.replace(/.*BYDAY=/, "")} · {c.start_time.slice(0, 5)}</li>)}</ul> : null}
          {loc ? <QuickClass programs={programs ?? []} locationId={loc.id} today={todayIn(tz)} /> : <p className="text-sm">Add your location first.</p>}
          <p className="text-sm text-fg-secondary">More options (instructors, rank and age bands, rooms) in <Link href="/desk/schedule/templates">Schedule → Classes</Link>.</p>
        </div>
      );
    }
    case "students":
      return (
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href="/desk/people/import">Import from a spreadsheet</Link></Button>
          <Button asChild variant="outline"><Link href="/desk/people/new">Add a family</Link></Button>
        </div>
      );
    case "payments":
      return <Button asChild><Link href="/desk/settings/payments">Open payment settings</Link></Button>;
    case "staff": {
      const { data: members } = await ctx.supabase.from("tenant_users").select("id, status, invited_email, roles(name, surface), profiles(full_name, email)").order("created_at");
      const staff = (members ?? []).filter((m) => m.roles?.surface !== "home");
      return (
        <div className="space-y-4">
          <ul className="divide-y divide-default text-sm" aria-label="Your team">
            {staff.map((m) => <li key={m.id} className="flex flex-wrap gap-2 py-2"><span className="font-medium">{m.profiles?.full_name || m.invited_email || m.profiles?.email}</span><span className="text-fg-muted">{m.roles?.name}</span>{m.status === "invited" ? <span className="text-warning">invited</span> : null}</li>)}
          </ul>
          <InviteForm />
        </div>
      );
    }
    case "branding": {
      const [{ data: t }, shell] = await Promise.all([ctx.supabase.from("tenants").select("branding").eq("id", tenantId).single(), loadShellData(ctx)]);
      const b = (t?.branding ?? {}) as { theme?: string; logo_path?: string };
      return <BrandingForm tenantId={tenantId} theme={b.theme ?? null} logoPath={b.logo_path ?? null} logoUrl={shell.logoUrl} />;
    }
    case "golive": {
      if (status.live) return <p className="text-sm">Your school is live. Change modules any time in <Link href="/desk/upgrade">Plan &amp; modules</Link>.</p>;
      const [{ modules, plans }, { data: t }] = await Promise.all([loadPricing(), ctx.supabase.from("tenants").select("stripe_onboarding_complete").eq("id", tenantId).single()]);
      return <GoLive plans={plans} modules={modules} planChoice={status.planChoice} stripeConnected={Boolean(t?.stripe_onboarding_complete)} />;
    }
  }
}
