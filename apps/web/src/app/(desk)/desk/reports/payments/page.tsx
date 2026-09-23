import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { canSeeMoney, MoneyReportShell } from "@/components/reports/money-shell";
import { requireSurfacePage } from "@/server/context";
import { paymentsLedger, reportRange } from "@/server/queries/money";

export const metadata = { title: "Payments & refunds" };

export default async function PaymentsReport({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!canSeeMoney(ctx)) forbidden();
  const range = reportRange(ctx, await searchParams);
  const rows = await paymentsLedger(ctx, range);
  const money = (c: number) => formatMoney(c, ctx.currency);
  const byMethod = new Map<string, { in: number; out: number }>();
  for (const r of rows) {
    const m = byMethod.get(r.method ?? "") ?? { in: 0, out: 0 };
    if ((r.amount_cents ?? 0) >= 0) m.in += r.amount_cents ?? 0;
    else m.out += -(r.amount_cents ?? 0);
    byMethod.set(r.method ?? "", m);
  }
  const totalIn = [...byMethod.values()].reduce((s, m) => s + m.in, 0);
  const totalOut = [...byMethod.values()].reduce((s, m) => s + m.out, 0);
  return (
    <MoneyReportShell title="Payments & refunds" description={`Received ${money(totalIn)} · refunded ${money(totalOut)} · net ${money(totalIn - totalOut)}`} report="payments" range={range}>
      {!rows.length ? <EmptyState title="No payments in this period" /> : (
        <>
          <div className="mb-4 overflow-x-auto rounded-xl border border-default bg-surface">
            <table className="w-full text-sm">
              <caption className="sr-only">Totals by method</caption>
              <thead className="border-b border-default text-left text-xs text-fg-secondary"><tr><th className="px-4 py-2">Method</th><th className="px-4 py-2 text-right">Received</th><th className="px-4 py-2 text-right">Refunded</th><th className="px-4 py-2 text-right">Net</th></tr></thead>
              <tbody className="divide-y divide-default">
                {[...byMethod.entries()].sort().map(([m, v]) => <tr key={m}><th scope="row" className="px-4 py-2 text-left font-normal capitalize">{m}</th><td className="px-4 py-2 text-right tabular">{money(v.in)}</td><td className="px-4 py-2 text-right tabular">{money(v.out)}</td><td className="px-4 py-2 text-right tabular">{money(v.in - v.out)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-xl border border-default bg-surface">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Payments and refunds</caption>
              <thead className="border-b border-default text-left text-xs text-fg-secondary"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Method</th><th className="px-4 py-2">Household</th><th className="px-4 py-2">Invoice</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-default">
                {rows.slice(0, 500).map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 tabular">{r.on_date}</td>
                    <td className="px-4 py-2 capitalize">{(r.kind ?? "").replace("_", " ")}</td>
                    <td className="px-4 py-2 capitalize">{r.method}</td>
                    <td className="px-4 py-2">{r.household_name}</td>
                    <td className="px-4 py-2">{r.invoice_number ? `#${r.invoice_number}` : "—"}</td>
                    <td className={`px-4 py-2 text-right tabular ${(r.amount_cents ?? 0) < 0 ? "text-danger" : ""}`}>{money(r.amount_cents ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 500 ? <p className="mt-2 text-xs text-fg-muted">Showing the latest 500 of {rows.length}; the CSV has them all.</p> : null}
        </>
      )}
    </MoneyReportShell>
  );
}
