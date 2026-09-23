import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";

/** Header + optional date range + CSV export for the money reports. */
export function MoneyReportShell({ title, description, report, range, children }: { title: string; description?: string; report: string; range?: { from: string; to: string }; children: ReactNode }) {
  const qs = range ? `&from=${range.from}&to=${range.to}` : "";
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/reports">Reports</Link>} title={title} description={description}
        actions={<Button asChild variant="outline" size="sm"><a href={`/desk/reports/money/export?report=${report}${qs}`} download>Export CSV</a></Button>} />
      {range ? (
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-fg-secondary">From<input type="date" name="from" defaultValue={range.from} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg" /></label>
          <label className="flex flex-col gap-1 text-xs text-fg-secondary">To<input type="date" name="to" defaultValue={range.to} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg" /></label>
          <Button type="submit" size="sm" variant="secondary">Apply</Button>
        </form>
      ) : null}
      {children}
    </>
  );
}

export function canSeeMoney(ctx: { permissions: ReadonlySet<string>; modules: ReadonlySet<string> }): boolean {
  return ctx.permissions.has("reports.read") && ctx.permissions.has("billing.read") && ctx.modules.has("billing");
}
