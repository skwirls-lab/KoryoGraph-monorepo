import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { canSeeMoney } from "@/components/reports/money-shell";
import { requireSurfacePage } from "@/server/context";
import { reportRange } from "@/server/queries/money";

export const metadata = { title: "Accounting export" };

export default async function AccountingExport({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!canSeeMoney(ctx)) forbidden();
  const range = reportRange(ctx, await searchParams);
  const qs = `from=${range.from}&to=${range.to}`;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/reports">Reports</Link>} title="Accounting export" description="CSV files your bookkeeper can import into QuickBooks or Xero." />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">From<input type="date" name="from" defaultValue={range.from} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg" /></label>
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">To<input type="date" name="to" defaultValue={range.to} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg" /></label>
        <Button type="submit" size="sm" variant="secondary">Apply</Button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-default bg-surface p-5" aria-labelledby="lines-h">
          <h2 id="lines-h" className="mb-1 font-semibold">Sales (invoice lines)</h2>
          <p className="mb-3 text-sm text-fg-secondary">One row per invoice line: date, invoice number, customer, GL account, description, quantity, amount net of tax, tax and total.</p>
          <Button asChild size="sm"><a href={`/desk/reports/money/export?report=accounting-lines&${qs}`} download>Download sales CSV</a></Button>
        </section>
        <section className="rounded-xl border border-default bg-surface p-5" aria-labelledby="payments-h">
          <h2 id="payments-h" className="mb-1 font-semibold">Payments &amp; refunds</h2>
          <p className="mb-3 text-sm text-fg-secondary">One row per payment received or refunded: date, customer, invoice, method, amount (refunds negative), reference.</p>
          <Button asChild size="sm"><a href={`/desk/reports/money/export?report=accounting-payments&${qs}`} download>Download payments CSV</a></Button>
        </section>
      </div>
    </>
  );
}
