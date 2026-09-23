import Link from "next/link";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";

/** Report page header: back to the library, range choices, and a CSV export of exactly what's shown. */
export function ReportHeader({ title, description, path, range, ranges, exportHref }: {
  title: string;
  description?: string;
  path: string;
  range?: number;
  ranges?: { value: number; label: string }[];
  exportHref: string;
}) {
  return (
    <PageHeader eyebrow={<Link href="/desk/reports">Reports</Link>} title={title} description={description}
      actions={<>
        {ranges?.map((r) => <Button key={r.value} asChild size="sm" variant={r.value === range ? "secondary" : "ghost"}><Link href={`${path}?months=${r.value}`} aria-current={r.value === range ? "page" : undefined}>{r.label}</Link></Button>)}
        <Button asChild variant="outline" size="sm"><a href={exportHref} download>Export CSV</a></Button>
      </>} />
  );
}

export const MONTH_RANGES = [{ value: 3, label: "3 months" }, { value: 6, label: "6 months" }, { value: 12, label: "12 months" }];
export const monthsParam = (v: string | undefined, fallback = 6) => { const n = Number(v); return [3, 6, 12].includes(n) ? n : fallback; };
export const monthLabel = (p: string) => new Date(`${p}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "numeric" });
