import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { RollbackImport, UploadImport } from "@/components/import/import-wizard";
import { PRESETS } from "@/lib/import/fields";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Import people" };

export default async function ImportsPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("people.write")) forbidden();
  const { data: imports } = await ctx.supabase.from("imports").select("id, file_name, preset, row_count, status, stats, created_at").order("created_at", { ascending: false }).limit(30);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/people">People</Link>} title="Import people" description="Bring students, families, ranks and memberships over from a spreadsheet or your previous system's export (CSV)." />
      <section className="space-y-3 rounded-xl border border-default bg-surface p-4 sm:p-6">
        <UploadImport />
        <p className="text-xs text-fg-muted">We recognise exports from {Object.values(PRESETS).map((p) => p.name).join(", ")} (column names are our best guess — you can fix any column on the next screen), or any spreadsheet with a header row.</p>
      </section>
      <section aria-labelledby="past-h" className="mt-6">
        <h2 id="past-h" className="mb-2 text-base font-semibold">Past imports</h2>
        {!imports?.length ? <p className="text-sm text-fg-muted">None yet.</p> : (
          <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Past imports">
            {imports.map((i) => {
              const s = (i.stats ?? {}) as Record<string, number>;
              return (
                <li key={i.id} aria-label={i.file_name} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                  <Link href={`/desk/people/import/${i.id}`} className="font-medium">{i.file_name}</Link>
                  <Badge variant={i.status === "committed" ? "secondary" : "outline"}>{i.status.replace("_", " ")}</Badge>
                  <span className="text-fg-muted">{i.row_count} rows{i.status === "committed" ? ` · ${s.created ?? 0} new, ${s.updated ?? 0} updated` : ""} · {new Date(i.created_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "medium", timeStyle: "short" })}</span>
                  {["committed", "failed", "committing"].includes(i.status) ? <span className="ml-auto"><RollbackImport id={i.id} file={i.file_name} /></span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
