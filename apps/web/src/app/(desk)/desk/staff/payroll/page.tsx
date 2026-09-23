import Link from "next/link";
import { forbidden } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { monthOf } from "@/lib/validation/staff";
import { requireSurfacePage } from "@/server/context";
import { isPeriod, payroll } from "@/server/queries/payroll";

export const metadata = { title: "Payroll" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("staff.manage")) forbidden();
  const { period: p } = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz }).format(new Date());
  const period = isPeriod(p) ? p : monthOf(today);
  const rows = await payroll(ctx, period);
  const sum = (k: "hourlyPayCents" | "classPayCents" | "commissionCents" | "totalCents") => rows.reduce((a, r) => a + r[k], 0);
  const label = new Date(`${period}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  const m = (c: number) => formatMoney(c, ctx.currency);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/staff">Staff</Link>} title={`Payroll · ${label}`}
        description="Clocked hours × hourly rate, classes taught × per-class rate, and commissions. Rates are set on each staff profile."
        actions={<nav aria-label="Period" className="flex flex-wrap gap-1">
          <Button asChild size="sm" variant="outline"><Link href={`?period=${monthOf(`${period}-01`, -1)}`}>Previous month</Link></Button>
          {period !== monthOf(today) ? <Button asChild size="sm" variant="outline"><Link href="?">This month</Link></Button> : null}
          <Button asChild size="sm" variant="outline"><Link href={`?period=${monthOf(`${period}-01`, 1)}`}>Next month</Link></Button>
          <Button asChild size="sm"><a href={`/desk/staff/payroll/export?period=${period}`} download>Export CSV</a></Button>
        </nav>} />
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Payroll for {label}</caption>
          <thead className="text-left text-xs text-fg-muted">
            <tr className="border-b border-default">
              <th scope="col" className="p-3">Staff</th><th scope="col" className="p-3 text-right">Hours</th><th scope="col" className="p-3 text-right">Hourly pay</th>
              <th scope="col" className="p-3 text-right">Classes</th><th scope="col" className="p-3 text-right">Class pay</th><th scope="col" className="p-3 text-right">Commissions</th><th scope="col" className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {!rows.length ? <tr><td colSpan={7} className="p-3 text-fg-muted">Nothing recorded for this month.</td></tr> : rows.map((r) => (
              <tr key={r.userId} aria-label={r.name}>
                <th scope="row" className="p-3 text-left font-medium"><Link href={`/desk/staff/${r.userId}`}>{r.name}</Link></th>
                <td className="p-3 text-right tabular-nums">{r.hours.toFixed(2)}</td>
                <td className="p-3 text-right tabular-nums">{m(r.hourlyPayCents)}{r.hourlyCents ? <span className="block text-xs text-fg-muted">@ {m(r.hourlyCents)}</span> : null}</td>
                <td className="p-3 text-right tabular-nums" data-testid="sessions">{r.sessions}</td>
                <td className="p-3 text-right tabular-nums">{m(r.classPayCents)}{r.perClassCents ? <span className="block text-xs text-fg-muted">@ {m(r.perClassCents)}</span> : null}</td>
                <td className="p-3 text-right tabular-nums">{m(r.commissionCents)}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{m(r.totalCents)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length ? (
            <tfoot className="border-t border-strong font-semibold">
              <tr aria-label="Totals"><th scope="row" className="p-3 text-left">Total</th><td /><td className="p-3 text-right tabular-nums">{m(sum("hourlyPayCents"))}</td><td /><td className="p-3 text-right tabular-nums">{m(sum("classPayCents"))}</td><td className="p-3 text-right tabular-nums">{m(sum("commissionCents"))}</td><td className="p-3 text-right tabular-nums">{m(sum("totalCents"))}</td></tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </>
  );
}
