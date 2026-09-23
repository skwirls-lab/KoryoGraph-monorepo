import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { canSeeMoney, MoneyReportShell } from "@/components/reports/money-shell";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "AR aging" };
const BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"];

export default async function ArAgingReport() {
  const ctx = await requireSurfacePage("desk");
  if (!canSeeMoney(ctx)) forbidden();
  const { data: rows } = await ctx.supabase.from("v_ar_aging").select("invoice_id, number, household_id, household_name, due_at, total_cents, balance_cents, days_overdue, bucket, dunning_stage").order("days_overdue", { ascending: false });
  const money = (c: number) => formatMoney(c, ctx.currency);
  const sum = (b: string) => (rows ?? []).filter((r) => r.bucket === b).reduce((s, r) => s + (r.balance_cents ?? 0), 0);
  return (
    <MoneyReportShell title="AR aging" description="Unpaid balances by days past due." report="ar">
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BUCKETS.map((b) => <div key={b} className="rounded-xl border border-default bg-surface p-3"><dt className="text-xs text-fg-secondary">{b === "current" ? "Not yet due" : `${b} days`}</dt><dd className="text-lg font-semibold tabular">{money(sum(b))}</dd></div>)}
      </dl>
      {!rows?.length ? <EmptyState title="Nothing outstanding" /> : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Unpaid invoices</caption>
            <thead className="border-b border-default text-left text-xs text-fg-secondary"><tr><th className="px-4 py-2">Invoice</th><th className="px-4 py-2">Household</th><th className="px-4 py-2">Due</th><th className="px-4 py-2 text-right">Days overdue</th><th className="px-4 py-2 text-right">Balance</th></tr></thead>
            <tbody className="divide-y divide-default">
              {rows.map((r) => (
                <tr key={r.invoice_id}>
                  <td className="px-4 py-2"><Link href={`/desk/billing/invoices/${r.invoice_id}`}>#{r.number}</Link></td>
                  <td className="px-4 py-2">{r.household_name}</td>
                  <td className="px-4 py-2 tabular">{r.due_at}</td>
                  <td className="px-4 py-2 text-right tabular">{r.days_overdue}</td>
                  <td className="px-4 py-2 text-right tabular">{money(r.balance_cents ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyReportShell>
  );
}
