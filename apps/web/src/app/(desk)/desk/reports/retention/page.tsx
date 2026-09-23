import { forbidden } from "next/navigation";
import { MONTH_RANGES, ReportHeader, monthLabel, monthsParam } from "@/components/reports/report-header";
import { todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { monthsBack, retentionCohorts } from "@/server/queries/growth";

export const metadata = { title: "Retention cohorts" };

export default async function RetentionReport({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const months = monthsParam((await searchParams).months, 12);
  const from = monthsBack(todayIn(ctx.tz), months - 1);
  const cohorts = ctx.modules.has("billing") && ctx.permissions.has("billing.read") ? await retentionCohorts(ctx, from) : null;
  const cols = Array.from({ length: months }, (_, k) => k);
  return (
    <>
      <ReportHeader title="Retention cohorts" description="Members grouped by the month they first joined; each column is the share still a member at the end of that month."
        path="/desk/reports/retention" range={months} ranges={MONTH_RANGES} exportHref={`/desk/reports/growth/export?report=retention&months=${months}`} />
      {!cohorts ? <p className="rounded-xl border border-dashed border-default p-4 text-sm text-fg-secondary">Retention is built from memberships, which need the Billing module and billing access.</p> : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <table className="w-full min-w-max border-separate border-spacing-0.5 p-2 text-xs">
            <caption className="sr-only">Share of each cohort still a member, by month since joining</caption>
            <thead><tr><th scope="col" className="px-2 py-1 text-left font-medium text-fg-muted">Joined</th><th scope="col" className="px-2 py-1 text-right font-medium text-fg-muted">Members</th>
              {cols.map((k) => <th key={k} scope="col" className="px-2 py-1 text-center font-medium text-fg-muted">M{k}</th>)}</tr></thead>
            <tbody>
              {!cohorts.length ? <tr><td colSpan={cols.length + 2} className="p-3 text-fg-muted">No one joined in this period.</td></tr> : cohorts.map((c) => (
                <tr key={c.cohort}>
                  <th scope="row" className="px-2 py-1 text-left font-medium">{monthLabel(c.cohort)}</th>
                  <td className="px-2 py-1 text-right tabular-nums">{c.size}</td>
                  {cols.map((k) => {
                    const r = c.retained[k];
                    if (r === undefined) return <td key={k} />;
                    const share = c.size ? r / c.size : 0;
                    return (
                      <td key={k} className="relative rounded-sm px-2 py-1 text-center tabular-nums" title={`${r} of ${c.size}`}>
                        <span aria-hidden className="absolute inset-0 rounded-sm bg-primary" style={{ opacity: 0.08 + share * 0.4 }} />
                        <span className="relative">{Math.round(share * 100)}%</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
