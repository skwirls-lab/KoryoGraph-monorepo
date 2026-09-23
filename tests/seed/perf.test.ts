import { afterAll, describe, expect, it } from "vitest";
import { asClaims, seededClaims, sql } from "../db/harness";
import { HEAVY } from "./perf-queries";

// M5.07: the ten heaviest Desk read paths stay under budget on the demo school (median of 3, RLS on).
afterAll(async () => {
  await sql.end();
});

describe("query performance on the demo seed", () => {
  it("each heavy query is under its budget", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const results: { name: string; ms: number; budgetMs: number }[] = [];
    for (const q of HEAVY) {
      await asClaims(owner, (tx) => q.run(tx)); // warm
      const t: number[] = [];
      for (let i = 0; i < 3; i++) {
        const s = performance.now();
        await asClaims(owner, (tx) => q.run(tx));
        t.push(performance.now() - s);
      }
      t.sort((a, b) => a - b);
      results.push({ name: q.name, ms: Math.round(t[1] ?? 0), budgetMs: q.budgetMs });
    }
    console.table(results);
    expect(results.filter((r) => r.ms > r.budgetMs)).toEqual([]);
  }, 120_000);
});
