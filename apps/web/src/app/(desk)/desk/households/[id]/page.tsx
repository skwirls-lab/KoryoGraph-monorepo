import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { HouseholdBilling } from "@/components/payments/household-billing";
import { AddExistingMember, AddNewMember, HouseholdDetails, MemberActions, PinForm } from "@/components/people/household-controls";
import { StatusBadge } from "@/components/people/status-badge";
import { ageOn, displayName, todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { getHousehold } from "@/server/queries/people";

export const metadata = { title: "Household" };

export default async function HouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("people.read")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getHousehold(ctx, id);
  if (!data) notFound();
  const { household: h, pin } = data;
  const canWrite = ctx.permissions.has("people.write");
  const today = todayIn(ctx.tz);
  const members = [...h.household_members].sort((a, b) => (a.relationship === b.relationship ? 0 : a.relationship === "guardian" ? -1 : 1));
  const lastName = members.find((m) => m.people)?.people?.last_name ?? "";

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/desk/people">People</Link>}
        title={h.name}
        description={`${members.length} ${members.length === 1 ? "person" : "people"}`}
        actions={canWrite ? <><AddExistingMember householdId={h.id} /><AddNewMember householdId={h.id} defaultLastName={lastName} /></> : null}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5 lg:col-span-2" aria-labelledby="members-h">
          <h2 id="members-h" className="mb-3 text-base font-semibold">Members</h2>
          <ul className="divide-y divide-default">
            {members.map((m) => m.people ? (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/desk/people/${m.person_id}`} className="font-medium">{displayName(m.people)}</Link>
                  <div className="text-xs text-fg-muted">
                    <span className="capitalize">{m.relationship}</span>
                    {h.primary_payer_person_id === m.person_id ? " · primary payer" : ""}
                    {m.people.dob ? ` · age ${ageOn(m.people.dob, today)}` : ""}
                    {m.people.allergies.length ? ` · allergies: ${m.people.allergies.join(", ")}` : ""}
                  </div>
                </div>
                <StatusBadge status={m.people.status} />
                {canWrite ? <MemberActions householdId={h.id} personId={m.person_id} isPayer={h.primary_payer_person_id === m.person_id} name={displayName(m.people)} /> : null}
              </li>
            ) : null)}
          </ul>
        </section>
        <div className="space-y-4">
          <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="details-h">
            <h2 id="details-h" className="mb-3 text-base font-semibold">Details</h2>
            {canWrite ? (
              <HouseholdDetails id={h.id} name={h.name} billingEmail={h.billing_email ?? ""} notes={h.notes ?? ""} />
            ) : (
              <p className="text-sm">{h.billing_email ?? "No billing email"}</p>
            )}
          </section>
          {canWrite ? (
            <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-label="Kiosk PIN">
              <PinForm householdId={h.id} hasPin={Boolean(pin) || false} />
            </section>
          ) : null}
          {ctx.modules.has("billing") && ctx.permissions.has("billing.read") ? <HouseholdBilling ctx={ctx} householdId={h.id} /> : null}
        </div>
      </div>
    </>
  );
}
