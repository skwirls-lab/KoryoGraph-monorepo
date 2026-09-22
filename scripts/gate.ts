import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv, repoRoot } from "./lib/env";

// Milestone gate (KORYOGRAPH-BUILD.md Appendix B.1). Cumulative: m2 runs m0–m2 e2e suites.
// usage: npm run gate -- <m0|m1|m2|m3|m4|m5|all>

loadEnv();

const MILESTONES = ["m0", "m1", "m2", "m3", "m4", "m5"] as const;
type Milestone = (typeof MILESTONES)[number];

const arg = process.argv[2];
if (!arg || !(arg === "all" || (MILESTONES as readonly string[]).includes(arg))) {
  console.error("usage: npm run gate -- <m0|m1|m2|m3|m4|m5|all>");
  process.exit(2);
}
const target = arg as Milestone | "all";
const level = target === "all" ? MILESTONES.length - 1 : MILESTONES.indexOf(target);

/** Task ids listed in PROGRESS.md's "Blocked" table — the only sanctioned way to exclude a red test. */
function blockedIds(): string[] {
  const progress = readFileSync(path.join(repoRoot, "docs/build/PROGRESS.md"), "utf8");
  const section = progress.split("## Blocked")[1]?.split("\n## ")[0] ?? "";
  return [...section.matchAll(/^\|\s*(M\d\.\d{2})\s*\|/gm)].map((m) => m[1] ?? "").filter(Boolean);
}

const blocked = blockedIds();
const keyTags: { tag: string; env: string }[] = [
  { tag: "@stripe", env: "STRIPE_SECRET_KEY" },
  { tag: "@ai-live", env: "OPENROUTER_API_KEY" },
  { tag: "@email", env: "RESEND_API_KEY" },
];
const skippedForKeys = keyTags.filter((k) => !process.env[k.env]);

interface Step {
  name: string;
  cmd: string;
  env?: Record<string, string>;
}

const e2eDirs = MILESTONES.slice(0, level + 1)
  .map((m) => `tests/e2e/${m}`)
  .filter((d) => existsSync(path.join(repoRoot, d)));
if (level >= MILESTONES.indexOf("m5") && existsSync(path.join(repoRoot, "tests/e2e/demo"))) e2eDirs.push("tests/e2e/demo");

const invert = [...blocked.map((id) => `@blocked:${id}`), ...skippedForKeys.map((k) => k.tag)];
const grepInvert = invert.length ? ` --grep-invert "${invert.join("|")}"` : "";
const demoSeedReady = readFileSync(path.join(repoRoot, "scripts/seed/index.ts"), "utf8").includes("seedDemo(");

const steps: Step[] = [
  { name: "typecheck", cmd: "npm run typecheck" },
  { name: "lint", cmd: "npm run lint" },
  { name: "unit", cmd: "npx vitest run --project unit" },
  {
    name: "db",
    cmd: "npx supabase db reset && npx tsx scripts/seed/index.ts --profile minimal && npx vitest run --project db",
  },
];
if (level >= 1 && demoSeedReady) steps.push({ name: "seed demo", cmd: "npx tsx scripts/seed/index.ts --profile demo" });
steps.push({
  name: `e2e (${e2eDirs.map((d) => path.basename(d)).join(", ")})`,
  cmd: `npx playwright test ${e2eDirs.join(" ")}${grepInvert}`,
  env: level >= MILESTONES.indexOf("m4") ? { AI_TRANSPORT: "fixture" } : undefined,
});
if (level >= MILESTONES.indexOf("m4") && process.env.OPENROUTER_API_KEY) steps.push({ name: "ai:eval (live)", cmd: "npm run ai:eval" });

interface Result {
  name: string;
  status: "pass" | "fail" | "not run";
  seconds: number;
}

const results: Result[] = [];
let failed = false;
for (const step of steps) {
  if (failed) {
    results.push({ name: step.name, status: "not run", seconds: 0 });
    continue;
  }
  console.log(`\n━━ gate ${target} › ${step.name}\n$ ${step.cmd}`);
  const started = Date.now();
  const r = spawnSync(step.cmd, { shell: true, stdio: "inherit", cwd: repoRoot, env: { ...process.env, ...step.env } });
  const ok = r.status === 0;
  results.push({ name: step.name, status: ok ? "pass" : "fail", seconds: (Date.now() - started) / 1000 });
  if (!ok) failed = true;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const lines = [
  `# Gate ${target} — ${failed ? "RED" : "GREEN"}`,
  "",
  `Run: ${new Date().toISOString()} · commit ${spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot }).stdout.toString().trim()}`,
  "",
  "| Step | Result | Time |",
  "|---|---|---|",
  ...results.map((r) => `| ${r.name} | ${r.status.toUpperCase()} | ${r.seconds.toFixed(1)}s |`),
  "",
  `Blocked (excluded via @blocked tags): ${blocked.length ? blocked.join(", ") : "none"}`,
  "",
  "## HANDOFF (not verified live)",
  ...(skippedForKeys.length
    ? skippedForKeys.map((k) => `- specs tagged ${k.tag} skipped: ${k.env} not set — these are NOT counted as passes`)
    : ["- none: every key-dependent suite ran"]),
  "",
];
const report = lines.join("\n");
console.log(`\n${report}`);
const dir = path.join(repoRoot, "docs/build/gates");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, `${target}-${stamp}.md`), report);
process.exit(failed ? 1 : 0);
