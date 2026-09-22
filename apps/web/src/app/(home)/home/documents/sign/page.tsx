import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { DocumentBody } from "@/components/documents/document-body";
import { HomeSign } from "@/components/documents/home-sign";
import { mergeDoc } from "@/lib/documents";
import { displayName } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Sign" };

export default async function HomeSignPage({ searchParams }: { searchParams: Promise<{ template?: string; person?: string }> }) {
  const ctx = await requireSurfacePage("home");
  const { template, person } = await searchParams;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!template || !person || !uuid.test(template) || !uuid.test(person)) notFound();
  const [{ data: t }, { data: p }, { data: meId }, { data: existing }] = await Promise.all([
    ctx.supabase.from("document_templates").select("id, name, version, body").eq("id", template).eq("active", true).maybeSingle(),
    ctx.supabase.from("people").select("id, first_name, last_name, preferred_name").eq("id", person).maybeSingle(),
    ctx.supabase.rpc("my_person_id"),
    ctx.supabase.from("signatures").select("id").eq("template_id", template).eq("person_id", person).maybeSingle(),
  ]);
  if (!t || !p) notFound();
  if (existing) redirect("/home/documents");
  const { data: me } = meId ? await ctx.supabase.from("people").select("first_name, last_name").eq("id", meId).maybeSingle() : { data: null };
  const body = mergeDoc(t.body, { student_name: displayName(p), guardian_name: me ? `${me.first_name} ${me.last_name}` : "", school_name: ctx.tenantName ?? "", date: new Date().toISOString().slice(0, 10) });
  return (
    <>
      <PageHeader eyebrow={<Link href="/home/documents">Forms</Link>} title={t.name} description={`Version ${t.version} · for ${displayName(p)}`} />
      <div className="space-y-6">
        <article className="rounded-xl border border-default bg-surface p-4" aria-label="Document"><DocumentBody body={body} /></article>
        <HomeSign templateId={t.id} personId={p.id} personName={displayName(p)} documentName={t.name} />
      </div>
    </>
  );
}
