import { afterschoolCutoff } from "./afterschool-cutoff";
import { aiModelsSync } from "./ai-models-sync";
import { automations } from "./automations";
import { billingRun } from "./billing-run";
import { dataExport } from "./data-export";
import { dunning } from "./dunning";
import { kbScheduleDigest } from "./kb-schedule-digest";
import { materializeSessions } from "./materialize-sessions";
import { outboxDispatch } from "./outbox-dispatch";
import { signaturePdfs } from "./signature-pdfs";
import type { Job } from "./types";

/** Every job the platform runs. Names match rows in public.jobs (seed.sql). */
export const JOBS: Record<string, Job> = {
  afterschool_cutoff: afterschoolCutoff,
  ai_models_sync: aiModelsSync,
  automations,
  billing_run: billingRun,
  data_export: dataExport,
  dunning,
  kb_schedule_digest: kbScheduleDigest,
  materialize_sessions: materializeSessions,
  outbox_dispatch: outboxDispatch,
  signature_pdfs: signaturePdfs,
};
