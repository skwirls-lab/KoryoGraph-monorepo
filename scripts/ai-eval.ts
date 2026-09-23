// `npm run ai:eval` — runs every registered task's examples live through OpenRouter and checks the output
// validates against the task schema. Without OPENROUTER_API_KEY it reports HANDOFF and changes nothing.
import { createAi, liveTransport, TASKS, TIERS, type AiRunRecord, type Tier } from "@koryo/ai";
import { loadEnv } from "./lib/env";

loadEnv();
const key = process.env.OPENROUTER_API_KEY ?? "";
if (!key) {
  console.log("HANDOFF: OPENROUTER_API_KEY is not set — ai:eval did not run (no live AI verification).");
  process.exit(0);
}
const models = Object.fromEntries(TIERS.map((t) => [t, process.env[`AI_MODEL_${t.toUpperCase()}`]]).filter(([, v]) => v)) as Partial<Record<Tier, string>>;
const runs: AiRunRecord[] = [];
const ai = createAi({
  transport: liveTransport({ apiKey: key, referer: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100", title: "KoryoGraph ai:eval" }),
  models, keyPresent: true,
  store: { budget: async () => null, price: async () => null, logRun: async (r) => { runs.push(r); return null; } },
});
const rows: { task: string; example: number; status: string; model: string; ms: number; costCents: string }[] = [];
for (const [id, task] of Object.entries(TASKS)) {
  for (const [i, example] of (task.examples ?? []).entries()) {
    const before = runs.length;
    try { await ai.runTask(task, example, { tenantId: "eval" }); } catch { /* recorded below */ }
    const r = runs[before];
    rows.push({ task: id, example: i, status: r?.status ?? "?", model: r?.model ?? "", ms: r?.latencyMs ?? 0, costCents: (r?.costCents ?? 0).toFixed(4) });
  }
}
console.table(rows);
const failed = rows.filter((r) => r.status !== "ok");
console.log(failed.length ? `ai:eval FAILED: ${failed.length} of ${rows.length}` : `ai:eval passed: ${rows.length} examples`);
process.exit(failed.length ? 1 : 0);
