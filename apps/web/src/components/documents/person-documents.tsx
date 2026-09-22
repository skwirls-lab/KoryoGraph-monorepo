import { DateText } from "@koryo/ui/components/app/date-text";
import { Badge } from "@koryo/ui/components/ui/badge";
import type { Ctx } from "@/server/context";
import { FileLink } from "./file-link";
import { SendLinkButton } from "./send-link-button";
import { UploadDocument } from "./upload-document";

export async function PersonDocuments({ ctx, personId }: { ctx: Ctx; personId: string }) {
  const [{ data: required }, { data: signatures }, { data: files }] = await Promise.all([
    ctx.supabase.from("v_required_documents").select("*").eq("person_id", personId),
    ctx.supabase.from("signatures").select("id, signed_at, typed_name, method, pdf_path, document_templates(name, version)").eq("person_id", personId).order("signed_at", { ascending: false }),
    ctx.supabase.from("documents").select("id, name, kind, storage_path, created_at, size").eq("person_id", personId).order("created_at", { ascending: false }),
  ]);
  const canWrite = ctx.permissions.has("people.write");
  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-label="Required documents">
        <h3 className="font-semibold">Required documents</h3>
        {!required?.length ? <p className="text-sm text-fg-muted">None required.</p> : (
          <ul className="space-y-1">
            {required.map((r) => (
              <li key={r.template_id} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{r.template_name} v{r.version}</span>
                {r.signature_id ? <Badge variant="outline" className="border-success/50 text-success">signed</Badge> : <Badge variant="outline" className="border-warning/50 text-warning">{r.signed_older_version ? "re-sign needed" : "unsigned"}</Badge>}
                {!r.signature_id && canWrite ? <SendLinkButton templateId={r.template_id as string} personId={personId} label={r.template_name ?? "document"} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2" aria-label="Signatures">
        <h3 className="font-semibold">Signatures</h3>
        {!signatures?.length ? <p className="text-sm text-fg-muted">No signatures yet.</p> : (
          <ul className="space-y-1 text-sm">
            {signatures.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                {s.document_templates?.name} v{s.document_templates?.version} · {s.typed_name} · {s.method} · <DateText value={s.signed_at} timeZone={ctx.tz} />
                {s.pdf_path ? <FileLink path={s.pdf_path} label="PDF" /> : <span className="text-xs text-fg-muted">PDF pending</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2" aria-label="Files">
        <h3 className="font-semibold">Files</h3>
        {canWrite ? <UploadDocument personId={personId} /> : null}
        {!files?.length ? <p className="text-sm text-fg-muted">No files.</p> : (
          <ul className="space-y-1 text-sm">
            {files.map((f) => <li key={f.id} className="flex items-center gap-2"><FileLink path={f.storage_path} label={f.name} /><span className="text-xs text-fg-muted">{f.kind} · <DateText value={f.created_at} timeZone={ctx.tz} /></span></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
