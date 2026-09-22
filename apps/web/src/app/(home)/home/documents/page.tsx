import Link from "next/link";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { FileLink } from "@/components/documents/file-link";
import { requireSurfacePage } from "@/server/context";
import { householdStudents } from "@/server/queries/home";

export const metadata = { title: "Forms" };

export default async function HomeDocuments() {
  const ctx = await requireSurfacePage("home");
  const students = await householdStudents(ctx);
  const ids = students.map((s) => s.id);
  const [{ data: required }, { data: signed }] = await Promise.all([
    ids.length ? ctx.supabase.from("v_required_documents").select("*").in("person_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? ctx.supabase.from("signatures").select("id, person_id, signed_at, pdf_path, typed_name, document_templates(name, version)").in("person_id", ids).order("signed_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const todo = (required ?? []).filter((r) => !r.signature_id);
  return (
    <>
      <PageHeader title="Forms" description="Waivers and agreements for your family." />
      <div className="space-y-8">
        <section aria-labelledby="todo-h" className="space-y-3">
          <h2 id="todo-h" className="text-lg font-semibold">To sign</h2>
          {todo.length === 0 ? <EmptyState title="You're all set" description="Nothing needs your signature right now." /> : (
            <ul className="space-y-2" aria-label="Documents to sign">
              {todo.map((r) => (
                <li key={`${r.template_id}-${r.person_id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/50 bg-surface p-4" aria-label={`${r.template_name} for ${r.person_name}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.template_name}</div>
                    <div className="text-sm text-fg-secondary">for {r.person_name}{r.signed_older_version ? " · updated — please sign the new version" : ""}</div>
                  </div>
                  <Button asChild><Link href={`/home/documents/sign?template=${r.template_id}&person=${r.person_id}`}>Review &amp; sign</Link></Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="signed-h" className="space-y-3">
          <h2 id="signed-h" className="text-lg font-semibold">Signed</h2>
          {!signed?.length ? <p className="text-sm text-fg-muted">Nothing signed yet.</p> : (
            <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Signed documents">
              {signed.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="font-medium">{s.document_templates?.name}</span><Badge variant="outline">v{s.document_templates?.version}</Badge>
                  <span className="text-sm text-fg-secondary">for {students.find((x) => x.id === s.person_id)?.first_name} · <DateText value={s.signed_at} timeZone={ctx.tz} /></span>
                  <span className="ml-auto">{s.pdf_path ? <FileLink path={s.pdf_path} label="PDF" /> : <span className="text-xs text-fg-muted">PDF being prepared</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
