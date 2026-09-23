import type { ChartSpec } from "@koryo/ai";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ResultTable } from "@/components/reports/ask-report";
import { ReportChart } from "@/components/reports/report-chart";
import { runReportSql } from "@/server/nl-reports";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Saved report" };

export default async function SavedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: r } = await ctx.supabase.from("saved_reports").select("id, name, question, sql, chart, created_at").eq("id", id).maybeSingle();
  if (!r) notFound();
  const run = await runReportSql(ctx, r.sql);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/reports">Reports</Link>} title={r.name} description={`“${r.question}” · live data, re-run now`} />
      {!run.ok ? <p role="alert" className="text-sm text-danger">{run.error}</p> : (
        <div className="space-y-4">
          <ReportChart rows={run.rows} spec={r.chart as unknown as ChartSpec} title={r.name} />
          <ResultTable rows={run.rows} />
          <details className="text-sm"><summary className="cursor-pointer text-fg-secondary">Show the query</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-elevated p-3 text-xs" tabIndex={0}>{r.sql}</pre></details>
        </div>
      )}
    </>
  );
}
