import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { KbDocForm, KbRowActions, KbSearchTester } from "@/components/kb/kb-controls";
import { KB_KINDS } from "@/lib/validation/kb";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Knowledge base" };

const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";

export default async function KnowledgePage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const { data: docs } = await ctx.supabase.from("kb_documents").select("id, title, kind, audience, body, source, chunk_count, embedding_model, indexed_at, index_error, updated_at").order("kind").order("title");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="Knowledge base"
        description="Policies, FAQs and curriculum text the copilot and the Home assistant answer from. Staff-only documents never reach families." />
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section className={card} aria-labelledby="docs-h">
          <h2 id="docs-h" className="mb-3 text-base font-semibold">Documents ({docs?.length ?? 0})</h2>
          {!docs?.length ? <p className="text-sm text-fg-muted">No documents yet. Add your refund policy, make-up policy and FAQs.</p> : (
            <ul className="divide-y divide-default text-sm" aria-label="Documents">
              {docs.map((d) => (
                <li key={d.id} aria-label={d.title} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.title}</span>
                    <Badge variant="outline">{KB_KINDS[d.kind as keyof typeof KB_KINDS] ?? d.kind}</Badge>
                    {d.audience === "staff" ? <Badge variant="secondary">staff only</Badge> : null}
                    {d.source === "auto" ? <Badge variant="outline">generated nightly</Badge> : null}
                    <span className="ml-auto"><KbRowActions id={d.id} title={d.title} /></span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    {d.chunk_count} chunk{d.chunk_count === 1 ? "" : "s"} · {d.embedding_model ? `embedded (${d.embedding_model === "fixture" ? "dev fixture vectors" : d.embedding_model})` : "text search only"}
                    {d.index_error ? ` — ${d.index_error}` : ""}{d.indexed_at ? ` · indexed ${new Date(d.indexed_at).toLocaleDateString("en-US", { timeZone: ctx.tz, dateStyle: "medium" })}` : " · not indexed"}
                  </p>
                  {d.source === "manual" ? (
                    <details className="mt-2"><summary className="cursor-pointer text-xs text-fg-secondary">Edit</summary>
                      <div className="mt-2"><KbDocForm initial={{ id: d.id, title: d.title, kind: d.kind as "policy", audience: d.audience as "everyone", body: d.body }} /></div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-4">
          <section className={card} aria-labelledby="test-h">
            <h2 id="test-h" className="mb-3 text-base font-semibold">Test a question</h2>
            <KbSearchTester />
          </section>
          <section className={card} aria-labelledby="add-h">
            <h2 id="add-h" className="mb-3 text-base font-semibold">Add a document</h2>
            <KbDocForm />
          </section>
        </div>
      </div>
    </>
  );
}
