// `npm run ai:record [taskId…]` — runs task examples live and writes their outputs as fixtures
// (tests/fixtures/ai/<taskId>/<hash>.json) for the fixture transport. Needs OPENROUTER_API_KEY.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAi, inputHash, liveTransport, TASKS, TIERS, type Tier } from "@koryo/ai";
import { loadEnv } from "./lib/env";

loadEnv();
const key = process.env.OPENROUTER_API_KEY ?? "";
if (!key) {
  console.error("OPENROUTER_API_KEY is not set — nothing recorded.");
  process.exit(1);
}
const only = new Set(process.argv.slice(2));
const models = Object.fromEntries(TIERS.map((t) => [t, process.env[`AI_MODEL_${t.toUpperCase()}`]]).filter(([, v]) => v)) as Partial<Record<Tier, string>>;
const ai = createAi({
  transport: liveTransport({ apiKey: key, referer: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100", title: "KoryoGraph ai:record" }),
  models, keyPresent: true, store: { budget: async () => null, price: async () => null, logRun: async () => null },
});
const dir = join(process.cwd(), "tests/fixtures/ai");
for (const [id, task] of Object.entries(TASKS)) {
  if (only.size && !only.has(id)) continue;
  for (const example of task.examples ?? []) {
    const parsed = task.input.parse(example);
    const hash = inputHash(id, task.fixtureKey ? task.fixtureKey(parsed) : parsed);
    const r = await ai.runTask(task, example, { tenantId: "record" });
    mkdirSync(join(dir, id), { recursive: true });
    writeFileSync(join(dir, id, `${hash}.json`), `${JSON.stringify({ recordedAt: new Date().toISOString(), model: r.model, output: r.output }, null, 2)}\n`);
    console.log(`recorded ${id}/${hash}`);
  }
}
