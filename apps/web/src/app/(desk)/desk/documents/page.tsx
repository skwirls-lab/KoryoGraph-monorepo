import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const ctx = await requireSurfacePage("desk");
  const [{ data: templates }, { data: required }] = await Promise.all([
    ctx.supabase.from("document_templates").select("id, name, kind, version, published_at, required_for").eq("active", true).order("name"),
    ctx.supabase.from("v_required_documents").select("template_id, signature_id"),
  ]);
  const stats = new Map<string, { total: number; signed: number }>();
  for (const r of required ?? []) {
    const s = stats.get(r.template_id as string) ?? { total: 0, signed: 0 };
    s.total++;
    if (r.signature_id) s.signed++;
    stats.set(r.template_id as string, s);
  }
  return (
    <>
      <PageHeader title="Documents" description="Waivers, agreements and policies families sign." actions={
        <>
          <Button asChild variant="outline" size="sm"><Link href="/desk/compliance">Compliance</Link></Button>
          {ctx.permissions.has("settings.manage") ? <Button asChild size="sm"><Link href="/desk/documents/new">New document</Link></Button> : null}
        </>
      } />
      {!templates?.length ? <EmptyState title="No documents yet" description="Publish your liability waiver and families will be asked to sign it." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => {
            const s = stats.get(t.id) ?? { total: 0, signed: 0 };
            return (
              <li key={t.id}>
                <Link href={`/desk/documents/${t.id}`} className="block rounded-xl border border-default bg-surface p-4 text-fg no-underline hover:border-strong" aria-label={`${t.name} version ${t.version}`}>
                  <div className="flex items-center gap-2"><h2 className="font-semibold">{t.name}</h2><Badge variant="outline">v{t.version}</Badge><Badge variant="secondary" className="capitalize">{t.kind.replace("_", " ")}</Badge></div>
                  <p className="mt-1 text-sm text-fg-secondary tabular">{s.total ? `${s.signed} of ${s.total} required signatures` : "Not required for anyone yet"}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
