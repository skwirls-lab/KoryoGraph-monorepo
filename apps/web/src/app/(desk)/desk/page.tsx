import Link from "next/link";
import { FailedPayments } from "@/components/billing/failed-payments";
import { UpcomingEvents } from "@/components/events/upcoming";
import { ScheduleSuggestions } from "@/components/schedule/suggestions";
import { StaffCompliance } from "@/components/staff/compliance";
import { OpenTasks } from "@/components/tasks/open-tasks";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { StatCard } from "@koryo/ui/components/app/stat-card";
import { requireSurfacePage } from "@/server/context";
import { locationScope } from "@/server/queries/locations";

export const metadata = { title: "Dashboard" };

/** This week so far vs the same point last week (never a partial week against a full one). */
function delta(now: number, before: number, fullLastWeek: number): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (before === 0) return { text: `Last week: ${fullLastWeek} in total`, tone: "neutral" };
  const pct = Math.round(((now - before) / before) * 100);
  return { text: `${pct >= 0 ? "+" : ""}${pct}% vs this point last week (${before}); ${fullLastWeek} all last week`, tone: pct > 0 ? "positive" : pct < 0 ? "negative" : "neutral" };
}

export default async function DeskDashboard() {
  const ctx = await requireSurfacePage("desk");
  const { data: d } = await ctx.supabase.from("v_owner_dashboard").select("*").eq("tenant_id", ctx.tenantId).maybeSingle();
  const atRisk = ctx.modules.has("intelligence") && ctx.permissions.has("people.read")
    ? (await ctx.supabase.from("v_risk_latest").select("person_id", { count: "exact", head: true }).eq("level", "high")).count ?? 0
    : null;
  const scope = await locationScope(ctx);
  const { data: rollup } = scope.multi ? await ctx.supabase.rpc("location_rollup") : { data: null };
  const att = delta(d?.attendance_this_week ?? 0, d?.attendance_last_week_to_date ?? 0, d?.attendance_last_week ?? 0);
  return (
    <>
      <PageHeader title="Dashboard" description={ctx.tenantName ?? undefined} actions={<Link href="/desk/reports" className="text-sm">All reports</Link>} />
      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active students" value={d?.active_students ?? 0} href="/desk/people?status=active&type=student" />
        <StatCard label="Trials" value={d?.trials ?? 0} hint={`${d?.leads ?? 0} leads`} href="/desk/people?status=trial" />
        <StatCard label="Attendance this week" value={d?.attendance_this_week ?? 0} delta={att.text} tone={att.tone} href="/desk/reports/attendance" />
        {atRisk !== null ? <StatCard label="At risk" value={atRisk} tone={atRisk > 0 ? "warning" : "neutral"} delta={atRisk > 0 ? "Drift Detector · nightly" : undefined} href="/desk/people?risk=high" /> : null}
        <StatCard label="Classes today" value={d?.classes_today ?? 0} href="/desk/schedule" />
        <StatCard label="Unsigned documents" value={d?.unsigned_documents ?? 0} tone={(d?.unsigned_documents ?? 0) > 0 ? "warning" : "neutral"} delta={(d?.unsigned_documents ?? 0) > 0 ? "Needs attention" : undefined} href="/desk/compliance" />
        <StatCard label="Unread conversations" value={d?.unread_threads ?? 0} href="/desk/inbox" />
      </section>
      {rollup && rollup.length > 1 ? (
        <section aria-labelledby="by-loc-h" className="mt-6 rounded-xl border border-default bg-surface p-4 sm:p-5">
          <h2 id="by-loc-h" className="mb-3 text-base font-semibold">By location</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Key numbers by location</caption>
            <thead><tr className="text-left text-fg-muted"><th className="py-1 font-medium">Location</th><th className="py-1 text-right font-medium">Active students</th><th className="py-1 text-right font-medium">Classes today</th><th className="py-1 text-right font-medium">Check-ins this week</th></tr></thead>
            <tbody className="divide-y divide-default">
              {rollup.map((r) => <tr key={r.location_id} className={r.location_id === scope.selected ? "font-semibold" : undefined}><th scope="row" className="py-1.5 text-left font-normal">{r.location_name}</th><td className="text-right tabular">{r.active_students}</td><td className="text-right tabular">{r.classes_today}</td><td className="text-right tabular">{r.attendance_this_week}</td></tr>)}
              <tr className="font-semibold"><th scope="row" className="py-1.5 text-left">All locations</th><td className="text-right tabular">{rollup.reduce((n, r) => n + r.active_students, 0)}</td><td className="text-right tabular">{rollup.reduce((n, r) => n + r.classes_today, 0)}</td><td className="text-right tabular">{rollup.reduce((n, r) => n + r.attendance_this_week, 0)}</td></tr>
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="More">
        {ctx.modules.has("billing") && ctx.permissions.has("billing.read") ? (
          <FailedPayments ctx={ctx} limit={5} />
        ) : (
          <div className="rounded-xl border border-dashed border-default p-4 text-sm text-fg-secondary">Revenue and past-due balances appear here with the Billing module.</div>
        )}
        <OpenTasks ctx={ctx} />
        <UpcomingEvents ctx={ctx} />
        <StaffCompliance ctx={ctx} limit={5} />
        <ScheduleSuggestions ctx={ctx} />
      </section>
    </>
  );
}
