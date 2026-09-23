import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { EndEnrollmentButton, EnrollForm } from "@/components/afterschool/enroll-form";
import { ProgramDialog } from "@/components/afterschool/program-form";
import { displayName } from "@/lib/people";
import { WEEKDAYS } from "@/lib/validation/afterschool";
import { requireSurfacePage } from "@/server/context";
import { fetchAll } from "@/server/lib/fetch-all";

export const metadata = { title: "After-school program" };

const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";

export default async function AfterschoolProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("events.manage")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await ctx.supabase.from("afterschool_programs").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz }).format(new Date());
  const [{ data: enr }, students] = await Promise.all([
    ctx.supabase.from("afterschool_enrollments").select("id, person_id, school, pickup_route, days_of_week, status, starts_on, ends_on, membership_id, people(first_name, last_name, preferred_name)").eq("program_id", id).order("status").order("created_at"),
    fetchAll((from, to) => ctx.supabase.from("people").select("id, first_name, last_name, preferred_name").contains("type_flags", ["student"]).is("archived_at", null).in("status", ["active", "trial"]).order("last_name").order("first_name").range(from, to)),
  ]);
  const open = new Set((enr ?? []).filter((e) => e.status !== "ended").map((e) => e.person_id));
  const active = (enr ?? []).filter((e) => e.status !== "ended");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/afterschool">After-school</Link>} title={p.name}
        description={`${formatMoney(p.weekly_price_cents, ctx.currency)}/week · ${WEEKDAYS.filter((d) => p.days_of_week.includes(d.value)).map((d) => d.short).join(" ")} · pickup cutoff ${p.pickup_cutoff.slice(0, 5)}${p.plan_id ? "" : ctx.modules.has("billing") ? " · no weekly plan (price is 0)" : " · billing off"}`}
        actions={<div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href={`/desk/afterschool/${p.id}/manifest?date=${today}`}>Today&apos;s manifest</Link></Button>
          <ProgramDialog billing={ctx.modules.has("billing")} initial={{ id: p.id, name: p.name, weeklyPrice: (p.weekly_price_cents / 100).toFixed(2), schools: p.schools.join("\n"), routes: p.routes.join("\n"), days: p.days_of_week, cutoff: p.pickup_cutoff.slice(0, 5) }} />
        </div>} />
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section className={card} aria-labelledby="roster-h">
          <h2 id="roster-h" className="mb-3 text-base font-semibold">Enrolled ({active.length})</h2>
          {!enr?.length ? <p className="text-sm text-fg-muted">No one enrolled yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-muted"><tr><th className="py-1 pr-2">Child</th><th className="pr-2">School</th><th className="pr-2">Route</th><th className="pr-2">Days</th><th className="pr-2">Billing</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody className="divide-y divide-default">
                  {enr.map((e) => {
                    const name = e.people ? displayName(e.people) : "Child";
                    return (
                      <tr key={e.id} aria-label={name} className={e.status === "ended" ? "text-fg-muted" : ""}>
                        <td className="py-2 pr-2"><Link href={`/desk/people/${e.person_id}`} className="font-medium">{name}</Link>{e.status === "ended" ? <Badge variant="outline" className="ml-1">ended {e.ends_on}</Badge> : null}</td>
                        <td className="pr-2">{e.school}</td>
                        <td className="pr-2">{e.pickup_route ?? "—"}</td>
                        <td className="pr-2">{WEEKDAYS.filter((d) => e.days_of_week.includes(d.value)).map((d) => d.short).join(" ")}</td>
                        <td className="pr-2">{e.membership_id ? <Link href={`/desk/people/${e.person_id}?tab=billing`}>weekly</Link> : "—"}</td>
                        <td className="text-right">{e.status !== "ended" ? <EndEnrollmentButton id={e.id} name={name} today={today} /> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className={card} aria-labelledby="enroll-h">
          <h2 id="enroll-h" className="mb-3 text-base font-semibold">Enroll a child</h2>
          <EnrollForm programId={p.id} people={students.filter((s) => !open.has(s.id)).map((s) => ({ id: s.id, name: displayName(s) }))} schools={p.schools} routes={p.routes} days={p.days_of_week} today={today} />
        </section>
      </div>
    </>
  );
}
