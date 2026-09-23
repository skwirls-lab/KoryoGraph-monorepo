import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aiFromEnv, aiTransportMode, createAi, parseJson } from "./gateway";
import { inputHash } from "./hash";
import { fixtureEmbedding, fixtureTransport } from "./transports";
import { AiError, type AiRunRecord, type AiStore, type AiTask, type CompletionRequest, type Transport } from "./types";

function memoryStore(budget: { limitCents: number; usedCents: number } | null = null) {
  const runs: AiRunRecord[] = [];
  const store: AiStore = {
    budget: async () => budget,
    price: async () => ({ inputPerM: 100, outputPerM: 200 }),
    logRun: async (r) => { runs.push(r); return `run-${runs.length}`; },
  };
  return { store, runs };
}

const task: AiTask<{ q: string }, { answer: number }> = {
  id: "test_task",
  tier: "fast",
  description: "test",
  input: z.object({ q: z.string() }),
  output: z.object({ answer: z.number().int() }),
  buildMessages: ({ q }) => [{ role: "user", content: q }],
  maxCostCents: 5,
};

function scripted(contents: string[], opts: { cost?: number | null; fail?: boolean } = {}) {
  const seen: CompletionRequest[] = [];
  const transport: Transport = {
    kind: "live",
    complete: async (req) => {
      seen.push(req);
      if (opts.fail) throw new Error("503 upstream");
      return { content: contents[req.attempt] ?? "", model: "test-model", tokensIn: 1000, tokensOut: 500, costCents: opts.cost === undefined ? null : opts.cost, latencyMs: 10, fixture: false };
    },
    embed: async () => ({ vectors: [[1, 0]], model: "embed-model", tokens: 3, costCents: 0.01, fixture: false }),
  };
  return { transport, seen };
}

const ctx = { tenantId: "t1", userId: "u1" };

describe("runTask", () => {
  it("returns validated output, logs an ok run and prices tokens when the provider doesn't report cost", async () => {
    const { store, runs } = memoryStore();
    const { transport, seen } = scripted(['{"answer": 42}']);
    const ai = createAi({ transport, models: { fast: "m-fast" }, keyPresent: true, store });
    const r = await ai.runTask(task, { q: "?" }, ctx);
    expect(r).toMatchObject({ output: { answer: 42 }, fixture: false, runId: "run-1" });
    expect(r.costCents).toBeCloseTo((1000 * 100 + 500 * 200) / 1_000_000);
    expect(seen[0]?.model).toBe("m-fast");
    expect(seen[0]?.jsonSchema).toMatchObject({ type: "object", properties: { answer: { type: "integer" } } });
    expect(runs[0]).toMatchObject({ status: "ok", attempts: 1, taskId: "test_task", tier: "fast", tenantId: "t1", userId: "u1" });
  });

  it("retries once with the validation errors, then succeeds", async () => {
    const { store, runs } = memoryStore();
    const { transport, seen } = scripted(['{"answer": "forty-two"}', '```json\n{"answer": 42}\n```'], { cost: 0.5 });
    const ai = createAi({ transport, models: { fast: "m" }, keyPresent: true, store });
    const r = await ai.runTask(task, { q: "?" }, ctx);
    expect(r.output.answer).toBe(42);
    expect(r.costCents).toBe(1);
    const retry = seen[1]?.messages.at(-1);
    expect(String(retry?.content)).toMatch(/answer/);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "ok", attempts: 2 });
  });

  it("fails with invalid_output after the retry", async () => {
    const { store, runs } = memoryStore();
    const ai = createAi({ transport: scripted(["nope", '{"answer": 1.5}']).transport, models: { fast: "m" }, keyPresent: true, store });
    await expect(ai.runTask(task, { q: "?" }, ctx)).rejects.toMatchObject({ code: "invalid_output", runId: "run-1" });
    expect(runs[0]).toMatchObject({ status: "invalid_output", attempts: 2 });
  });

  it("refuses when the budget can't cover the task, without calling out", async () => {
    const { store, runs } = memoryStore({ limitCents: 5000, usedCents: 4998 });
    const { transport, seen } = scripted(['{"answer": 1}']);
    const ai = createAi({ transport, models: { fast: "m" }, keyPresent: true, store });
    await expect(ai.runTask(task, { q: "?" }, ctx)).rejects.toMatchObject({ code: "budget_exceeded" });
    expect(seen).toHaveLength(0);
    expect(runs[0]?.status).toBe("budget_exceeded");
  });

  it("no key → typed no_key error and a logged run; no model → no_model", async () => {
    const a = memoryStore();
    const noKey = createAi({ transport: scripted([]).transport, models: { fast: "m" }, keyPresent: false, store: a.store });
    const err = await noKey.runTask(task, { q: "?" }, ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err).toMatchObject({ code: "no_key" });
    expect(a.runs[0]?.status).toBe("no_key");
    const b = memoryStore();
    const noModel = createAi({ transport: scripted([]).transport, models: {}, keyPresent: true, store: b.store });
    await expect(noModel.runTask(task, { q: "?" }, ctx)).rejects.toMatchObject({ code: "no_model" });
    expect(b.runs[0]?.status).toBe("no_model");
  });

  it("provider failures are logged and surfaced as provider_error", async () => {
    const { store, runs } = memoryStore();
    const ai = createAi({ transport: scripted([], { fail: true }).transport, models: { fast: "m" }, keyPresent: true, store });
    await expect(ai.runTask(task, { q: "?" }, ctx)).rejects.toMatchObject({ code: "provider_error" });
    expect(runs[0]).toMatchObject({ status: "provider_error", error: "503 upstream" });
  });

  it("rejects bad input before doing anything", async () => {
    const { store, runs } = memoryStore();
    const ai = createAi({ transport: scripted([]).transport, models: { fast: "m" }, keyPresent: true, store });
    await expect(ai.runTask(task, { q: 1 }, ctx)).rejects.toThrow();
    expect(runs).toHaveLength(0);
  });
});

describe("fixture transport", () => {
  const dir = mkdtempSync(join(tmpdir(), "ai-fixtures-"));
  mkdirSync(join(dir, "test_task"));
  writeFileSync(join(dir, "test_task", `${inputHash("test_task", { q: "recorded" })}.json`), JSON.stringify({ output: { answer: 7 }, model: "recorded-model" }));
  writeFileSync(join(dir, "test_task", `${inputHash("test_task", { q: "retry" })}.json`), JSON.stringify({ responses: [{ answer: "x" }, { answer: 8 }] }));

  it("replays a recorded input (marked as fixture, zero cost) and a recorded retry", async () => {
    const { store, runs } = memoryStore();
    const ai = createAi({ transport: fixtureTransport(dir), models: {}, keyPresent: false, store });
    await expect(ai.runTask(task, { q: "recorded" }, ctx)).resolves.toMatchObject({ output: { answer: 7 }, fixture: true, costCents: 0, model: "recorded-model" });
    await expect(ai.runTask(task, { q: "retry" }, ctx)).resolves.toMatchObject({ output: { answer: 8 } });
    expect(runs.map((r) => [r.transport, r.status, r.attempts])).toEqual([["fixture", "ok", 1], ["fixture", "ok", 2]]);
  });

  it("never invents an answer for an unrecorded input", async () => {
    const { store, runs } = memoryStore();
    const ai = createAi({ transport: fixtureTransport(dir), models: {}, keyPresent: false, store });
    await expect(ai.runTask(task, { q: "new question" }, ctx)).rejects.toMatchObject({ code: "no_fixture" });
    expect(runs[0]?.status).toBe("no_fixture");
  });

  it("fixture embeddings are deterministic, normalised and lexically similar", () => {
    const a = fixtureEmbedding("Refund policy: refunds within 30 days");
    const b = fixtureEmbedding("what is the refund policy");
    const c = fixtureEmbedding("dress code for sparring class");
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * (y[i] ?? 0), 0);
    expect(fixtureEmbedding("Refund policy: refunds within 30 days")).toEqual(a);
    expect(dot(a, a)).toBeCloseTo(1);
    expect(dot(a, b)).toBeGreaterThan(dot(a, c));
  });
});

describe("aiFromEnv", () => {
  const { store } = memoryStore();
  it("chooses live with a key, fixture without; models only from env", () => {
    expect(aiFromEnv({}, store, { fixturesDir: "/nope" }).status()).toMatchObject({ transport: "fixture", keyPresent: false, models: { fast: null, frontier: null } });
    const live = aiFromEnv({ OPENROUTER_API_KEY: "sk-or-test", AI_MODEL_FAST: "vendor/fast" }, store, { fixturesDir: "/nope" }).status();
    expect(live).toMatchObject({ transport: "live", keyPresent: true, models: { fast: "vendor/fast", embed: null } });
    expect(aiFromEnv({ OPENROUTER_API_KEY: "k", AI_TRANSPORT: "fixture" }, store, { fixturesDir: "/nope" }).status().transport).toBe("fixture");
  });
  it("fixtures are refused in production: no key there means live (and a no_key error), never replayed answers", () => {
    expect(aiTransportMode({ NODE_ENV: "production", AI_TRANSPORT: "fixture" })).toBe("live");
    expect(aiTransportMode({ NODE_ENV: "production" })).toBe("live");
    expect(aiTransportMode({ NODE_ENV: "development" })).toBe("fixture");
    expect(aiTransportMode({ NODE_ENV: "test", AI_TRANSPORT: "fixture", OPENROUTER_API_KEY: "k" })).toBe("fixture");
  });
  it("parseJson accepts fenced output", () => {
    expect(parseJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });
});
