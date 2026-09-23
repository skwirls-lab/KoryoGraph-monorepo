import { z } from "zod";
import { inputHash } from "./hash";
import { fixtureTransport, liveTransport } from "./transports";
import { AiError, TIERS, type AiRunRecord, type AiStore, type AiTask, type ChatMessage, type Tier, type Transport } from "./types";

export interface AiContext { tenantId: string; userId?: string | null }

export interface AiResult<O> {
  output: O;
  runId: string | null;
  /** True when the answer came from a recorded dev fixture (the UI shows a badge). */
  fixture: boolean;
  model: string;
  costCents: number;
}

export interface AiConfig {
  transport: Transport;
  /** Model per tier; a live call to an unconfigured tier fails with `no_model`. */
  models: Partial<Record<Tier, string>>;
  keyPresent: boolean;
  store: AiStore;
}

export interface AiStatus { transport: "live" | "fixture"; keyPresent: boolean; models: Record<Tier, string | null> }

const JSON_INSTRUCTION = "Respond with a single JSON value that matches the provided JSON schema. No prose, no code fences.";

/** Parse model output as JSON, tolerating a fenced block. */
export function parseJson(content: string): unknown {
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(content);
  return JSON.parse(fenced?.[1] ?? content);
}

export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

export function createAi(cfg: AiConfig) {
  const log = async (base: Omit<AiRunRecord, "error" | "output"> & { error?: string | null; output?: unknown }) =>
    cfg.store.logRun({ output: null, error: null, ...base }).catch(() => null);

  const preflight = async (tier: Tier, taskId: string, ctx: AiContext, hash: string, input: unknown, maxCostCents: number) => {
    const live = cfg.transport.kind === "live";
    const model = live ? cfg.models[tier] ?? null : "fixture";
    const base = { tenantId: ctx.tenantId, userId: ctx.userId ?? null, taskId, tier, model, transport: cfg.transport.kind, inputHash: hash, input, tokensIn: 0, tokensOut: 0, costCents: 0, latencyMs: 0, attempts: 0 } as const;
    if (live && !cfg.keyPresent) {
      const id = await log({ ...base, status: "no_key", error: "OPENROUTER_API_KEY is not set" });
      throw new AiError("no_key", "AI isn't configured: no OpenRouter API key.", id);
    }
    if (live && !model) {
      const id = await log({ ...base, status: "no_model", error: `AI_MODEL_${tier.toUpperCase()} is not set` });
      throw new AiError("no_model", `No model is configured for the ${tier} tier (AI_MODEL_${tier.toUpperCase()}).`, id);
    }
    const budget = await cfg.store.budget(ctx.tenantId);
    if (budget && budget.usedCents + maxCostCents > budget.limitCents) {
      const id = await log({ ...base, status: "budget_exceeded", error: `used ${budget.usedCents}¢ of ${budget.limitCents}¢` });
      throw new AiError("budget_exceeded", "This month's AI budget is used up.", id);
    }
    return { base, model: model ?? "" };
  };

  const priced = async (model: string, tokensIn: number, tokensOut: number, reported: number | null) => {
    if (reported !== null) return reported;
    const p = await cfg.store.price(model);
    return p ? (tokensIn * p.inputPerM + tokensOut * p.outputPerM) / 1_000_000 : 0;
  };

  async function runTask<I, O>(task: AiTask<I, O>, rawInput: unknown, ctx: AiContext): Promise<AiResult<O>> {
    const input = task.input.parse(rawInput);
    const hash = inputHash(task.id, task.fixtureKey ? task.fixtureKey(input) : input);
    const { base, model } = await preflight(task.tier, task.id, ctx, hash, input, task.maxCostCents);
    const jsonSchema = jsonSchemaFor(task.output);
    const messages: ChatMessage[] = [{ role: "system", content: JSON_INSTRUCTION }, ...task.buildMessages(input)];
    let tokensIn = 0;
    let tokensOut = 0;
    let cost = 0;
    let latency = 0;
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await cfg.transport.complete({ taskId: task.id, model, messages, jsonSchema, temperature: task.temperature, fixtureHash: hash, attempt });
      } catch (err) {
        const code = err instanceof AiError ? err.code : "provider_error";
        const message = err instanceof Error ? err.message : String(err);
        const id = await log({ ...base, status: code, error: message.slice(0, 1000), tokensIn, tokensOut, costCents: cost, latencyMs: latency, attempts: attempt + 1 });
        throw new AiError(code, code === "no_fixture" ? message : "The AI provider didn't answer. Try again in a moment.", id);
      }
      tokensIn += res.tokensIn;
      tokensOut += res.tokensOut;
      latency += res.latencyMs;
      cost += await priced(res.model, res.tokensIn, res.tokensOut, res.costCents);
      let parsed: unknown;
      try {
        parsed = parseJson(res.content);
      } catch {
        lastError = "The answer wasn't valid JSON.";
        messages.push({ role: "assistant", content: res.content }, { role: "user", content: `${lastError} ${JSON_INSTRUCTION}` });
        continue;
      }
      const checked = task.output.safeParse(parsed);
      if (checked.success) {
        const runId = await log({ ...base, model: res.model, status: "ok", output: checked.data, tokensIn, tokensOut, costCents: cost, latencyMs: latency, attempts: attempt + 1 });
        return { output: checked.data, runId, fixture: res.fixture, model: res.model, costCents: cost };
      }
      lastError = checked.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      messages.push({ role: "assistant", content: res.content }, { role: "user", content: `That didn't match the schema (${lastError}). ${JSON_INSTRUCTION}` });
    }
    const id = await log({ ...base, status: "invalid_output", error: lastError.slice(0, 1000), tokensIn, tokensOut, costCents: cost, latencyMs: latency, attempts: 2 });
    throw new AiError("invalid_output", "The AI answer didn't have the expected shape, even after a retry.", id);
  }

  async function embed(texts: string[], ctx: AiContext): Promise<{ vectors: number[][]; fixture: boolean; model: string }> {
    const hash = inputHash("embed", texts);
    const { base, model } = await preflight("embed", "embed", ctx, hash, { count: texts.length }, 1);
    try {
      const res = await cfg.transport.embed(model, texts);
      const cost = await priced(res.model, res.tokens, 0, res.costCents);
      await log({ ...base, model: res.model, status: "ok", output: { dims: res.vectors[0]?.length ?? 0 }, tokensIn: res.tokens, costCents: cost, attempts: 1 });
      return { vectors: res.vectors, fixture: res.fixture, model: res.model };
    } catch (err) {
      const id = await log({ ...base, status: "provider_error", error: (err instanceof Error ? err.message : String(err)).slice(0, 1000), attempts: 1 });
      throw new AiError("provider_error", "Embedding failed.", id);
    }
  }

  const status = (): AiStatus => ({
    transport: cfg.transport.kind,
    keyPresent: cfg.keyPresent,
    models: Object.fromEntries(TIERS.map((t) => [t, cfg.models[t] ?? null])) as Record<Tier, string | null>,
  });

  return { runTask, embed, status };
}
export type Ai = ReturnType<typeof createAi>;

type Env = Readonly<Record<string, string | undefined>>;

/**
 * From the environment (see aiTransportMode; fixture output carries the dev-fixture badge), models from
 * AI_MODEL_<TIER>. No model ids are baked into code; a deployment picks them.
 */
/**
 * Transport in effect: `AI_TRANSPORT=live|fixture`, or when unset live with a key and fixtures without.
 * Fixtures are refused in production (NODE_ENV=production): there, no key means AI says "no key".
 */
export function aiTransportMode(env: Env, apiKey = env.OPENROUTER_API_KEY ?? ""): "live" | "fixture" {
  const production = env.NODE_ENV === "production";
  if (env.AI_TRANSPORT === "live") return "live";
  if (env.AI_TRANSPORT === "fixture") return production ? "live" : "fixture";
  return apiKey || production ? "live" : "fixture";
}

export function aiFromEnv(env: Env, store: AiStore, opts: { fixturesDir: string; fallback?: boolean; apiKey?: string | null }): Ai {
  const apiKey = opts.apiKey ?? env.OPENROUTER_API_KEY ?? "";
  const mode = aiTransportMode(env, apiKey);
  const models = Object.fromEntries(TIERS.map((t) => [t, env[`AI_MODEL_${t.toUpperCase()}`] || undefined]).filter(([, v]) => v)) as Partial<Record<Tier, string>>;
  const transport = mode === "live"
    ? liveTransport({ apiKey: apiKey || "missing", referer: env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100", title: "KoryoGraph" })
    : fixtureTransport(opts.fixturesDir, { fallback: opts.fallback ?? env.AI_FIXTURE_FALLBACK === "1" });
  return createAi({ transport, models, keyPresent: Boolean(apiKey), store });
}
