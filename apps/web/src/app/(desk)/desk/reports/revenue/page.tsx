import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { canSeeMoney, MoneyReportShell } from "@/components/reports/money-shell";
import { requireSurfacePage } from "@/server/context";
import { reportRange, revenueByMonth } from "@/server/queries/money";

export const metadata = { title: "Revenue" };

const monthLabel = (m: string) => new Date(`${m}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export default async function RevenueReport({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!canSeeMoney(ctx)) forbidden();
  const range = reportRange(ctx, await searchParams);
  const r = await revenueByMonth(ctx, range);
  const money = (c: number) => formatMoney(c, ctx.currency);
  const monthTotal = (m: string) => r.classes.reduce((s, c) => s + (r.cells.get(`${m}|${c}`) ?? 0), 0);
  const max = Math.max(1, ...r.months.map(monthTotal));
  return (
    <MoneyReportShell title="Revenue" description={`Invoiced revenue net of tax, ${range.from} → ${range.to}: ${money(r.total)} (plus ${money(r.tax)} tax collected)`} report="revenue" range={range}>
      {!r.months.length ? <EmptyState title="No revenue in this period" /> : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Revenue by month and GL class</caption>
            <thead className="border-b border-default text-left text-xs text-fg-secondary">
              <tr><th className="px-4 py-2">Month</th>{r.classes.map((c) => <th key={c} className="px-4 py-2 text-right">{c}</th>)}<th className="px-4 py-2 text-right">Total</th><th className="w-40 px-4 py-2"><span className="sr-only">Chart</span></th></tr>
            </thead>
            <tbody className="divide-y divide-default">
              {r.months.map((m) => (
                <tr key={m}>
                  <th scope="row" className="px-4 py-2 text-left font-normal">{monthLabel(m)}</th>
                  {r.classes.map((c) => <td key={c} className="px-4 py-2 text-right tabular">{money(r.cells.get(`${m}|${c}`) ?? 0)}</td>)}
                  <td className="px-4 py-2 text-right font-medium tabular">{money(monthTotal(m))}</td>
                  <td className="px-4 py-2"><span aria-hidden className="block h-2.5 rounded-r-[4px] bg-primary" style={{ width: `${Math.max(0, (monthTotal(m) / max) * 100)}%` }} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-default font-semibold">
              <tr><th scope="row" className="px-4 py-2 text-left">Total</th>{r.classes.map((c) => <td key={c} className="px-4 py-2 text-right tabular">{money(r.months.reduce((s, m) => s + (r.cells.get(`${m}|${c}`) ?? 0), 0))}</td>)}<td className="px-4 py-2 text-right tabular">{money(r.total)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      )}
    </MoneyReportShell>
  );
}
