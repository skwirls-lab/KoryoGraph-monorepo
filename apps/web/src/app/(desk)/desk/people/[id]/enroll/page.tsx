import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { EnrollWizard, type WizardPlan } from "@/components/billing/enroll-wizard";
import { ModuleLocked } from "@/components/billing/module-locked";
import { cardEntryBlocker } from "@/components/payments/household-billing";
import { displayName, todayIn } from "@/lib/people";
import type { PlanKind } from "@/lib/validation/billing";
import { requireSurfacePage } from "@/server/context";
import { listSavedCards } from "@/server/queries/payments";

export const metadata = { title: "Enroll in membership" };

export default async function EnrollPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("billing.charge")) forbidden();
  if (!ctx.modules.has("billing")) return <ModuleLocked title="Enroll in membership" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: person }, { data: memberships }, { data: plans }] = await Promise.all([
    ctx.supabase.from("people").select("id, first_name, last_name, preferred_name, uniform_size, belt_size").eq("id", id).maybeSingle(),
    ctx.supabase.from("household_members").select("households(id, name)").eq("person_id", id),
    ctx.supabase.from("membership_plans").select("id, name, kind, description, price_cents, interval, interval_count, enrollment_fee_cents").eq("active", true).order("sort").order("name"),
  ]);
  if (!person) notFound();
  const name = displayName(person);
  const header = <PageHeader eyebrow={<Link href={`/desk/people/${id}?tab=billing`}>{name}</Link>} title="Enroll in membership" />;
  const households = (memberships ?? []).flatMap((m) => (m.households ? [m.households] : []));
  if (!households.length) {
    return <>{header}<EmptyState title="No household" description={`Add ${name} to a household first; memberships are billed to a household.`} /></>;
  }
  if (!plans?.length) {
    return <>{header}<EmptyState title="No plans yet" description="Create a membership plan in Billing → Plans first." /></>;
  }
  const withCards = await Promise.all(households.map(async (h) => ({ ...h, cards: await listSavedCards(ctx, h.id) })));
  const wizardPlans: WizardPlan[] = plans.map((p) => ({
    id: p.id, name: p.name, kind: p.kind as PlanKind, description: p.description, priceCents: p.price_cents, enrollmentFeeCents: p.enrollment_fee_cents,
    every: p.interval ? `/${p.interval_count > 1 ? `${p.interval_count} ${p.interval}s` : p.interval}` : "",
  }));
  return (
    <>
      {header}
      <EnrollWizard
        personId={id}
        personName={name}
        households={withCards}
        plans={wizardPlans}
        today={todayIn(ctx.tz)}
        currency={ctx.currency}
        sizes={{ uniform: person.uniform_size, belt: person.belt_size }}
        cardBlocker={await cardEntryBlocker(ctx)}
      />
    </>
  );
}
