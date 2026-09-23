import Link from "next/link";
import { FailedPayments } from "@/components/billing/failed-payments";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { StatCard } from "@koryo/ui/components/app/stat-card";
import { requireSurfacePage } from "@/server/context";

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
  const att = delta(d?.attendance_this_week ?? 0, d?.attendance_last_week_to_date ?? 0, d?.attendance_last_week ?? 0);
  return (
    <>
      <PageHeader title="Dashboard" description={ctx.tenantName ?? undefined} actions={<Link href="/desk/reports" className="text-sm">All reports</Link>} />
      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active students" value={d?.active_students ?? 0} href="/desk/people?status=active&type=student" />
        <StatCard label="Trials" value={d?.trials ?? 0} hint={`${d?.leads ?? 0} leads`} href="/desk/people?status=trial" />
        <StatCard label="Attendance this week" value={d?.attendance_this_week ?? 0} delta={att.text} tone={att.tone} href="/desk/reports/attendance" />
        <StatCard label="Classes today" value={d?.classes_today ?? 0} href="/desk/schedule" />
        <StatCard label="Unsigned documents" value={d?.unsigned_documents ?? 0} tone={(d?.unsigned_documents ?? 0) > 0 ? "warning" : "neutral"} delta={(d?.unsigned_documents ?? 0) > 0 ? "Needs attention" : undefined} href="/desk/compliance" />
        <StatCard label="Unread conversations" value={d?.unread_threads ?? 0} href="/desk/inbox" />
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="More">
        {ctx.modules.has("billing") && ctx.permissions.has("billing.read") ? (
          <FailedPayments ctx={ctx} limit={5} />
        ) : (
          <div className="rounded-xl border border-dashed border-default p-4 text-sm text-fg-secondary">Revenue and past-due balances appear here with the Billing module.</div>
        )}
        <div className="rounded-xl border border-dashed border-default p-4 text-sm text-fg-secondary">Upcoming belt tests appear here once testing events are built (M3). At-risk students arrive with Intelligence (M4).</div>
      </section>
    </>
  );
}
