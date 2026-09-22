import { materializeSessions } from "./materialize-sessions";
import { outboxDispatch } from "./outbox-dispatch";
import type { Job } from "./types";

/** Every job the platform runs. Names match rows in public.jobs (seed.sql). */
export const JOBS: Record<string, Job> = {
  materialize_sessions: materializeSessions,
  outbox_dispatch: outboxDispatch,
};
