import "server-only";
import { createServiceClient } from "@koryo/db/service";
import { logger } from "../log";
import { JOBS } from "./registry";
import type { JobStats } from "./types";

export class UnknownJobError extends Error {}

/** Runs a job with a job_runs row (started → ok/error, stats, error text). Service role (jobs are trusted code). */
export async function runJob(name: string, opts: { now?: Date; tenantId?: string | null; params?: Record<string, string> } = {}): Promise<{ runId: string; status: "ok" | "error"; stats: JobStats; error?: string }> {
  const job = JOBS[name];
  if (!job) throw new UnknownJobError(`Unknown job ${name}`);
  const db = createServiceClient();
  const log = logger({ tenantId: opts.tenantId ?? null }).child({ job: name });
  const { data: run, error: runError } = await db.from("job_runs").insert({ job_name: name, for_tenant_id: opts.tenantId ?? null, status: "running" }).select("id").single();
  if (runError || !run) throw new Error(`job_runs insert failed: ${runError?.message}`);
  try {
    const stats = await job({ db, now: opts.now ?? new Date(), tenantId: opts.tenantId ?? null, log, params: opts.params ?? {} });
    await db.from("job_runs").update({ status: "ok", finished_at: new Date().toISOString(), stats }).eq("id", run.id);
    return { runId: run.id, status: "ok", stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "job failed");
    await db.from("job_runs").update({ status: "error", finished_at: new Date().toISOString(), error: message }).eq("id", run.id);
    return { runId: run.id, status: "error", stats: {}, error: message };
  }
}
