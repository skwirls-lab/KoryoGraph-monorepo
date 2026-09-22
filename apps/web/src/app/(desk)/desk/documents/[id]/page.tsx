import Link from "next/link";
import { notFound } from "next/navigation";
import { DateText } from "@koryo/ui/components/app/date-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { DocumentBody } from "@/components/documents/document-body";
import { DocumentForm } from "@/components/documents/document-form";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Document" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: t } = await ctx.supabase.from("document_templates").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const [{ data: versions }, { data: programs }] = await Promise.all([
    ctx.supabase.from("document_templates").select("id, version, published_at, active").eq("name", t.name).order("version", { ascending: false }),
    ctx.supabase.from("programs").select("id, name").eq("active", true).order("name"),
  ]);
  const req = t.required_for as { all_students?: boolean; program_ids?: string[] };
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/documents">Documents</Link>} title={t.name} description={<span className="inline-flex items-center gap-2"><Badge variant="outline">v{t.version}</Badge>{t.active ? "current" : "superseded"} · published <DateText value={t.published_at} timeZone={ctx.tz} /></span>} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-default bg-surface p-5" aria-label="Document text"><DocumentBody body={t.body} /></section>
        <aside className="space-y-4">
          <section className="rounded-xl border border-default bg-surface p-4">
            <h2 className="mb-2 font-semibold">Versions</h2>
            <ol className="space-y-1 text-sm">{(versions ?? []).map((v) => <li key={v.id}><Link href={`/desk/documents/${v.id}`}>v{v.version}</Link> · <DateText value={v.published_at} timeZone={ctx.tz} />{v.active ? " · current" : ""}</li>)}</ol>
          </section>
        </aside>
      </div>
      {ctx.permissions.has("settings.manage") && t.active ? (
        <section className="mt-8 space-y-3" aria-labelledby="newver-h">
          <h2 id="newver-h" className="text-lg font-semibold">Publish a new version</h2>
          <p className="text-sm text-fg-secondary">Everyone it applies to will be asked to sign again. Earlier signatures stay on record with the version they signed.</p>
          <DocumentForm nameLocked submitLabel={`Publish version ${t.version + 1}`} programs={programs ?? []}
            initial={{ name: t.name, kind: t.kind as "waiver", body: t.body, allStudents: Boolean(req.all_students), programIds: req.program_ids ?? [] }} />
        </section>
      ) : null}
    </>
  );
}
