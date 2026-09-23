import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ImportWizard, RollbackImport } from "@/components/import/import-wizard";
import type { Mapping } from "@/lib/import/fields";
import { requireSurfacePage } from "@/server/context";
import { loadImportFile } from "@/server/imports";

export const metadata = { title: "Import" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("people.write")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const f = await loadImportFile(ctx, id);
  if (!f) notFound();
  const samples = Object.fromEntries(f.parsed.headers.map((h) => [h, f.parsed.records.slice(0, 3).map((r) => r[h] ?? "")]));
  const { data: imp } = await ctx.supabase.from("imports").select("status, stats, row_count").eq("id", id).single();
  const s = (imp?.stats ?? {}) as Record<string, number>;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/people/import">Import people</Link>} title={f.imp.file_name} description={`${imp?.row_count ?? 0} rows · ${f.parsed.headers.length} columns`} />
      {imp?.status === "uploaded" ? (
        <ImportWizard id={id} headers={f.parsed.headers} samples={samples} initial={f.imp.mapping as Mapping} preset={f.imp.preset} canAi={ctx.modules.has("intelligence")} />
      ) : (
        <section className="space-y-3 rounded-xl border border-default bg-surface p-4 text-sm" role="status">
          <p>This import is <strong>{imp?.status.replace("_", " ")}</strong>{imp?.status === "committed" ? `: ${s.created ?? 0} new people, ${s.updated ?? 0} updated, ${s.households ?? 0} households, ${s.enrollments ?? 0} rank enrollments, ${s.memberships ?? 0} memberships.` : "."}</p>
          {["committed", "failed", "committing"].includes(imp?.status ?? "") ? <RollbackImport id={id} file={f.imp.file_name} /> : null}
        </section>
      )}
    </>
  );
}
