import { afterschoolCutoff } from "./afterschool-cutoff";
import { aiModelsSync } from "./ai-models-sync";
import { automations } from "./automations";
import { billingRun } from "./billing-run";
import { dataExport } from "./data-export";
import { driftScore } from "./drift-score";
import { dunning } from "./dunning";
import { kbScheduleDigest } from "./kb-schedule-digest";
import { leadScoring } from "./lead-scoring";
import { materializeSessions } from "./materialize-sessions";
import { outboxDispatch } from "./outbox-dispatch";
import { parentNarratives } from "./parent-narratives";
import { scheduleSuggestionsJob } from "./schedule-suggestions";
import { techniqueFeedbackJob } from "./technique-feedback";
import { webhookDispatch } from "./webhook-dispatch";
import { signaturePdfs } from "./signature-pdfs";
import { transcribeJob } from "./transcribe";
import type { Job } from "./types";

/** Every job the platform runs. Names match rows in public.jobs (seed.sql). */
export const JOBS: Record<string, Job> = {
  afterschool_cutoff: afterschoolCutoff,
  ai_models_sync: aiModelsSync,
  automations,
  billing_run: billingRun,
  data_export: dataExport,
  drift_score: driftScore,
  dunning,
  kb_schedule_digest: kbScheduleDigest,
  lead_scoring: leadScoring,
  materialize_sessions: materializeSessions,
  outbox_dispatch: outboxDispatch,
  parent_narratives: parentNarratives,
  schedule_suggestions: scheduleSuggestionsJob,
  technique_feedback: techniqueFeedbackJob,
  webhook_dispatch: webhookDispatch,
  signature_pdfs: signaturePdfs,
  transcribe: transcribeJob,
};
