import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { AskReport } from "@/components/reports/ask-report";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Ask a report" };

export default async function AskReportPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const { q } = await searchParams;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/reports">Reports</Link>} title="Ask a report"
        description="Ask in plain English. KoryoGraph writes a query over your report data (read-only, your school only), charts it, and shows you the query." />
      {ctx.modules.has("intelligence") ? <AskReport initial={q?.slice(0, 300)} /> : <p className="text-sm text-fg-secondary">Plain-English reports are part of the Intelligence module.</p>}
    </>
  );
}
