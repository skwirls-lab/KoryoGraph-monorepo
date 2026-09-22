import { storeSignaturePdf } from "../documents/render";
import type { Job } from "./types";

/** Renders and stores PDFs for signatures that don't have one yet (link/desk signatures, retries). */
export const signaturePdfs: Job = async ({ db, tenantId, log }) => {
  let q = db.from("signatures").select("id").is("pdf_path", null).order("signed_at").limit(100);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) throw new Error(`signatures: ${error.message}`);
  let rendered = 0;
  let failed = 0;
  for (const s of data ?? []) {
    try {
      await storeSignaturePdf(db, s.id);
      rendered++;
    } catch (err) {
      failed++;
      log.warn({ signature: s.id, err: err instanceof Error ? err.message : String(err) }, "signature PDF failed");
    }
  }
  return { rendered, failed };
};
