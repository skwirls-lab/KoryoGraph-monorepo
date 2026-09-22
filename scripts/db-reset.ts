import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import { repoRoot } from "./lib/env";

// npm run db:reset [-- --profile minimal|demo]  → supabase db reset (migrations + seed.sql) + TypeScript seed.
const { values } = parseArgs({ options: { profile: { type: "string", default: "minimal" } }, allowPositionals: true });
const run = (cmd: string) => execSync(cmd, { stdio: "inherit", cwd: repoRoot });

run("npx supabase db reset");
run(`npx tsx scripts/seed/index.ts --profile ${values.profile ?? "minimal"}`);
