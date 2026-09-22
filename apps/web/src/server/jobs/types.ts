import type { ServiceClient } from "@koryo/db/service";
import type { Logger } from "pino";

export interface JobContext {
  db: ServiceClient;
  now: Date;
  /** Limit the run to one tenant (tests, manual runs); null = every tenant. */
  tenantId: string | null;
  log: Logger;
  params: Record<string, string>;
}

export type JobStats = Record<string, number | string | boolean>;
export type Job = (ctx: JobContext) => Promise<JobStats>;
