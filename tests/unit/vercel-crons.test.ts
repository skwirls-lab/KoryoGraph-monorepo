import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Deploy config stays in sync with the jobs the migrations register (name + cron schedule).
const ROOT = path.resolve(import.meta.dirname, "../..");

describe("vercel.json crons", () => {
  it("has exactly one cron per registered job, with the same schedule", () => {
    const jobs = new Map<string, string>();
    const dir = path.join(ROOT, "supabase/migrations");
    // Jobs are registered by migrations and by seed.sql (reference data, applied with `db push --include-seed`).
    const files = [...readdirSync(dir).filter((n) => n.endsWith(".sql")).sort().map((n) => path.join(dir, n)), path.join(ROOT, "supabase/seed.sql")];
    for (const f of files) {
      const sql = readFileSync(f, "utf8");
      for (const block of sql.matchAll(/insert into public\.jobs \(name, schedule[^)]*\) values([\s\S]*?);/g)) {
        for (const m of (block[1] ?? "").matchAll(/\(\s*'([a-z_]+)'\s*,\s*'([^']+)'/g)) jobs.set(m[1] as string, m[2] as string);
      }
    }
    const vercel = JSON.parse(readFileSync(path.join(ROOT, "apps/web/vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(Object.fromEntries(vercel.crons.map((c) => [c.path.replace("/api/jobs/", ""), c.schedule]))).toEqual(Object.fromEntries(jobs));
    // …and every job the code can run is registered (so it has a schedule and a cron).
    const registry = readFileSync(path.join(ROOT, "apps/web/src/server/jobs/registry.ts"), "utf8");
    const code = [...(registry.split("JOBS")[1] ?? "").matchAll(/^\s{2}([a-z_]+)[:,]/gm)].map((m) => m[1] as string).sort();
    expect(code).toEqual([...jobs.keys()].sort());
  });
});
