import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { InviteForm } from "@/components/onboarding/steps";
import { StaffCompliance } from "@/components/staff/compliance";
import { CloseEntryButton } from "@/components/staff/staff-forms";
import { requireSurfacePage } from "@/server/context";
import { staffList } from "@/server/queries/staff";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("staff.manage")) forbidden();
  const [staff, { data: invited }] = await Promise.all([
    staffList(ctx),
    ctx.supabase.from("tenant_users").select("id, invited_email, roles(name)").eq("status", "invited").order("created_at"),
  ]);
  return (
    <>
      <PageHeader title="Staff" description="Profiles, certifications, the time clock, shifts and payroll."
        actions={<div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link href="/desk/staff/shifts">Shifts</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/desk/staff/payroll">Payroll</Link></Button>
        </div>} />
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="staff-h">
          <h2 id="staff-h" className="mb-3 text-base font-semibold">Team ({staff.length})</h2>
          <ul className="divide-y divide-default text-sm" aria-label="Staff">
            {staff.map((s) => (
              <li key={s.userId} aria-label={s.name} className="flex flex-wrap items-center gap-2 py-2">
                <Link href={`/desk/staff/${s.userId}`} className="font-medium">{s.name}</Link>
                <span className="text-fg-secondary">{s.title ?? s.role}</span>
                {!s.hasPin ? <Badge variant="outline">no kiosk PIN</Badge> : null}
                <span className="ml-auto flex items-center gap-2">
                  {s.clockedInAt ? <><Badge variant="secondary">In since {new Date(s.clockedInAt).toLocaleTimeString("en-US", { timeZone: ctx.tz, timeStyle: "short" })}</Badge>{s.openEntryId ? <CloseEntryButton id={s.openEntryId} name={s.name} /> : null}</> : <span className="text-xs text-fg-muted">clocked out</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <StaffCompliance ctx={ctx} />
      </div>
      <section className="mt-4 rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="invite-h">
        <h2 id="invite-h" className="mb-3 text-base font-semibold">Invite staff</h2>
        {invited?.length ? <ul className="mb-3 text-sm" aria-label="Pending invitations">{invited.map((i) => <li key={i.id}>{i.invited_email} · {i.roles?.name} · invited</li>)}</ul> : null}
        <InviteForm />
      </section>
    </>
  );
}
