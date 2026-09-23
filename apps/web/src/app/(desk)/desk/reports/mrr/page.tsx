import { forbidden } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { StatCard } from "@koryo/ui/components/app/stat-card";
import { canSeeMoney, MoneyReportShell } from "@/components/reports/money-shell";
import { requireSurfacePage } from "@/server/context";
import { mrrHistory } from "@/server/queries/money";

export const metadata = { title: "MRR & churn" };

const monthLabel = (m: string) => new Date(`${m}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export default async function MrrReport() {
  const ctx = await requireSurfacePage("desk");
  if (!canSeeMoney(ctx)) forbidden();
  const rows = await mrrHistory(ctx);
  const money = (c: number) => formatMoney(c, ctx.currency);
  const last = rows.at(-1);
  const churned = rows.reduce((s, r) => s + (r.churned_mrr_cents ?? 0), 0);
  const max = Math.max(1, ...rows.map((r) => r.mrr_cents ?? 0));
  return (
    <MoneyReportShell title="MRR & churn" description="Monthly recurring revenue from recurring and contract memberships (weekly × 52/12, yearly ÷ 12)." report="mrr">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="MRR now" value={money(last?.mrr_cents ?? 0)} hint={`${last?.memberships ?? 0} memberships`} />
        <StatCard label="ARR" value={money((last?.mrr_cents ?? 0) * 12)} />
        <StatCard label="Churned MRR, 12 months" value={money(churned)} tone={churned ? "negative" : "neutral"} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">MRR by month</caption>
          <thead className="border-b border-default text-left text-xs text-fg-secondary"><tr><th className="px-4 py-2">Month</th><th className="px-4 py-2 text-right">MRR (month end)</th><th className="px-4 py-2 text-right">New</th><th className="px-4 py-2 text-right">Churned</th><th className="px-4 py-2 text-right">Memberships</th><th className="w-40 px-4 py-2"><span className="sr-only">Chart</span></th></tr></thead>
          <tbody className="divide-y divide-default">
            {rows.map((r) => (
              <tr key={r.month}>
                <th scope="row" className="px-4 py-2 text-left font-normal">{monthLabel(r.month ?? "")}</th>
                <td className="px-4 py-2 text-right font-medium tabular">{money(r.mrr_cents ?? 0)}</td>
                <td className="px-4 py-2 text-right tabular text-success">{r.new_mrr_cents ? `+${money(r.new_mrr_cents)}` : "—"}</td>
                <td className="px-4 py-2 text-right tabular text-danger">{r.churned_mrr_cents ? `−${money(r.churned_mrr_cents)}` : "—"}</td>
                <td className="px-4 py-2 text-right tabular">{r.memberships}</td>
                <td className="px-4 py-2"><span aria-hidden className="block h-2.5 rounded-r-[4px] bg-primary" style={{ width: `${((r.mrr_cents ?? 0) / max) * 100}%` }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MoneyReportShell>
  );
}
