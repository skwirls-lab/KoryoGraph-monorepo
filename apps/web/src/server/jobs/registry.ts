import { dataExport } from "./data-export";
import { materializeSessions } from "./materialize-sessions";
import { outboxDispatch } from "./outbox-dispatch";
import { signaturePdfs } from "./signature-pdfs";
import type { Job } from "./types";

/** Every job the platform runs. Names match rows in public.jobs (seed.sql). */
export const JOBS: Record<string, Job> = {
  data_export: dataExport,
  materialize_sessions: materializeSessions,
  outbox_dispatch: outboxDispatch,
  signature_pdfs: signaturePdfs,
};
