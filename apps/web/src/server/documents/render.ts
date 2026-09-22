import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@koryo/db/types";
import { mergeDoc } from "@/lib/documents";
import { renderSignaturePdf } from "./pdf";

type Db = SupabaseClient<Database>;

/**
 * Render a signature's PDF and store it privately under the student's household folder
 * (`<tenant>/households/<household>/signatures/<id>.pdf`), then record the path. Works with a
 * user-scoped client (the signer) or the service role (signature_pdfs job).
 */
export async function storeSignaturePdf(db: Db, signatureId: string): Promise<string> {
  const { data: s, error } = await db
    .from("signatures")
    .select("id, tenant_id, person_id, signer_person_id, typed_name, signed_at, ip, method, template_id, document_templates(name, version, body), tenants(name, timezone)")
    .eq("id", signatureId)
    .single();
  if (error || !s) throw new Error(`signature ${signatureId}: ${error?.message}`);
  const [{ data: person }, { data: signer }, { data: hm }] = await Promise.all([
    db.from("people").select("first_name, last_name, preferred_name").eq("id", s.person_id).single(),
    s.signer_person_id ? db.from("people").select("first_name, last_name").eq("id", s.signer_person_id).single() : Promise.resolve({ data: null }),
    db.from("household_members").select("household_id").eq("person_id", s.person_id).limit(1).maybeSingle(),
  ]);
  const personName = person ? `${person.preferred_name || person.first_name} ${person.last_name}` : "Student";
  const signerName = signer ? `${signer.first_name} ${signer.last_name}` : s.typed_name;
  const tz = s.tenants?.timezone ?? "UTC";
  const signedAt = new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "long", timeStyle: "long" }).format(new Date(s.signed_at));
  const body = mergeDoc(s.document_templates?.body ?? "", {
    student_name: personName, guardian_name: signerName, school_name: s.tenants?.name ?? "", date: new Date(s.signed_at).toISOString().slice(0, 10),
  });
  const bytes = await renderSignaturePdf({
    schoolName: s.tenants?.name ?? "", documentName: s.document_templates?.name ?? "Document", version: s.document_templates?.version ?? 1,
    body, personName, signerName, typedName: s.typed_name, signedAt, ip: s.ip, method: s.method, signatureId: s.id,
  });
  const folder = hm?.household_id ? `households/${hm.household_id}` : `people/${s.person_id}`;
  const path = `${s.tenant_id}/${folder}/signatures/${s.id}.pdf`;
  const { error: upErr } = await db.storage.from("tenant-media").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr && !/exists/i.test(upErr.message)) throw new Error(`upload: ${upErr.message}`);
  const { error: updErr } = await db.from("signatures").update({ pdf_path: path }).eq("id", s.id).is("pdf_path", null);
  if (updErr) throw new Error(`pdf_path: ${updErr.message}`);
  return path;
}
