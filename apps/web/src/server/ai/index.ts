import "server-only";
import { resolve } from "node:path";
import { aiFromEnv, type Ai, type AiRunRecord, type AiStore } from "@koryo/ai";
import type { Json } from "@koryo/db/types";
import type { Ctx } from "../context";

/** Recorded dev fixtures (tests/fixtures/ai) — replayed when there's no OpenRouter key or AI_TRANSPORT=fixture. */
export const FIXTURES_DIR = resolve(process.cwd(), process.cwd().endsWith("apps/web") ? "../.." : ".", "tests/fixtures/ai");

export const row = (r: AiRunRecord) => ({
  task_id: r.taskId, tier: r.tier, model: r.model, transport: r.transport, status: r.status, input_hash: r.inputHash,
  input: (r.input ?? null) as Json, output: (r.output ?? null) as Json, error: r.error, tokens_in: r.tokensIn, tokens_out: r.tokensOut,
  cost_cents: r.costCents, latency_ms: r.latencyMs, attempts: r.attempts,
});

/** Store for user-facing AI: logs as the signed-in user through log_ai_run (tenant from their JWT). */
export function userStore(ctx: Ctx): AiStore {
  return {
    async budget() {
      const { data } = await ctx.supabase.rpc("ai_budget_status");
      const b = data?.[0];
      return b ? { limitCents: b.limit_cents, usedCents: Number(b.used_cents) } : null;
    },
    async price(model) {
      const { data } = await ctx.supabase.from("ai_models").select("input_per_m_cents, output_per_m_cents").eq("id", model).maybeSingle();
      return data ? { inputPerM: Number(data.input_per_m_cents), outputPerM: Number(data.output_per_m_cents) } : null;
    },
    async logRun(r) {
      const { data } = await ctx.supabase.rpc("log_ai_run", { p: row(r) as unknown as Json });
      return data ?? null;
    },
  };
}

export function aiFor(ctx: Ctx): Ai {
  return aiFromEnv(process.env, userStore(ctx), { fixturesDir: FIXTURES_DIR });
}
