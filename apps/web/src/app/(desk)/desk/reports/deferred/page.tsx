import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { canSeeMoney, MoneyReportShell } from "@/components/reports/money-shell";
import { requireSurfacePage } from "@/server/context";
import { deferredRevenue } from "@/server/queries/money";

export const metadata = { title: "Deferred revenue" };

export default async function DeferredReport() {
  const ctx = await requireSurfacePage("desk");
  if (!canSeeMoney(ctx)) forbidden();
  const rows = await deferredRevenue(ctx);
  const money = (c: number) => formatMoney(c, ctx.currency);
  const total = rows.reduce((s, r) => s + (r.deferred_cents ?? 0), 0);
  return (
    <MoneyReportShell title="Deferred revenue" description={`Paid-in-full memberships, recognised evenly by month. Not yet earned: ${money(total)}.`} report="deferred">
      {!rows.length ? <EmptyState title="No paid-in-full memberships" /> : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Deferred revenue by membership</caption>
            <thead className="border-b border-default text-left text-xs text-fg-secondary"><tr><th className="px-4 py-2">Membership</th><th className="px-4 py-2">Started</th><th className="px-4 py-2 text-right">Months</th><th className="px-4 py-2 text-right">Paid</th><th className="px-4 py-2 text-right">Earned</th><th className="px-4 py-2 text-right">Deferred</th></tr></thead>
            <tbody className="divide-y divide-default">
              {rows.map((r) => (
                <tr key={r.membership_id}>
                  <td className="px-4 py-2">{r.person_id ? <Link href={`/desk/people/${r.person_id}?tab=billing`}>{r.plan_name}</Link> : r.plan_name}</td>
                  <td className="px-4 py-2 tabular">{r.starts_at}</td>
                  <td className="px-4 py-2 text-right tabular">{r.months}</td>
                  <td className="px-4 py-2 text-right tabular">{money(r.amount_cents ?? 0)}</td>
                  <td className="px-4 py-2 text-right tabular">{money((r.amount_cents ?? 0) - (r.deferred_cents ?? 0))}</td>
                  <td className="px-4 py-2 text-right font-medium tabular">{money(r.deferred_cents ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyReportShell>
  );
}
