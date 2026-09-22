import { isDue } from "@koryo/scheduling";
import postgres from "postgres";
import { loadEnv, requireEnv } from "./lib/env";

// npm run jobs:tick — run every job whose cron schedule has come due since its last successful run,
// through the same /api/jobs/<name> route Vercel Cron calls (dev server must be running).
// `-- --force <name>` runs one job now regardless of schedule.
loadEnv();
const base = process.env.JOBS_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
const secret = requireEnv("CRON_SECRET");
const force = process.argv.includes("--force") ? process.argv[process.argv.indexOf("--force") + 1] : undefined;
const sql = postgres(process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres", { onnotice: () => undefined });

try {
  const jobs = await sql<{ name: string; schedule: string; last: Date | null }[]>`
    select j.name, j.schedule, (select max(r.started_at) from public.job_runs r where r.job_name = j.name and r.status = 'ok' and r.for_tenant_id is null) as last
    from public.jobs j where j.enabled order by j.name`;
  const now = new Date();
  for (const j of jobs) {
    if (force ? j.name !== force : !isDue(j.schedule, now, j.last)) continue;
    const res = await fetch(`${base}/api/jobs/${j.name}`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    const body = (await res.json()) as unknown;
    console.log(`${j.name}: ${res.status} ${JSON.stringify(body)}`);
    if (!res.ok) process.exitCode = 1;
  }
} finally {
  await sql.end();
}
