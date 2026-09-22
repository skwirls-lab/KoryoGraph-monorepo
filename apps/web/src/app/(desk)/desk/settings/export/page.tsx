import Link from "next/link";
import { forbidden } from "next/navigation";
import { DateText } from "@koryo/ui/components/app/date-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { FileLink } from "@/components/documents/file-link";
import { ExportButton } from "@/components/settings/export-button";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Data export" };

export default async function ExportPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("exports.run")) forbidden();
  const { data: exports } = await ctx.supabase.from("exports").select("id, status, created_at, file_path, stats, error, expires_at").order("created_at", { ascending: false }).limit(20);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="Data export" description="Download everything your school has in KoryoGraph — one JSON file per table in a ZIP. You can leave any time; that's the point." actions={<ExportButton />} />
      {!exports?.length ? <p className="text-sm text-fg-muted">No exports yet.</p> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Exports">
          {exports.map((e) => {
            const tables = Object.keys((e.stats ?? {}) as Record<string, number>).length;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <DateText value={e.created_at} timeZone={ctx.tz} style="datetime" />
                <Badge variant="outline">{e.status}</Badge>
                {tables ? <span className="text-sm text-fg-secondary">{tables} tables</span> : null}
                {e.error ? <span className="text-sm text-danger">{e.error}</span> : null}
                <span className="ml-auto">{e.status === "ready" && e.file_path ? <FileLink path={e.file_path} label="Download ZIP" /> : null}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
