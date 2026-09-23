import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import OpenAI from "openai";
import { AiError, type CompletionRequest, type CompletionResponse, type EmbeddingResponse, type Transport } from "./types";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Live transport: the OpenAI SDK pointed at OpenRouter (structured output, usage accounting). */
export function liveTransport(opts: { apiKey: string; referer: string; title: string; baseURL?: string }): Transport {
  const client = new OpenAI({ baseURL: opts.baseURL ?? OPENROUTER_BASE_URL, apiKey: opts.apiKey, defaultHeaders: { "HTTP-Referer": opts.referer, "X-Title": opts.title } });
  return {
    kind: "live",
    async complete(req: CompletionRequest): Promise<CompletionResponse> {
      const started = Date.now();
      const params = {
        model: req.model,
        messages: req.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: req.temperature,
        response_format: { type: "json_schema" as const, json_schema: { name: req.taskId.replace(/[^a-zA-Z0-9_-]/g, "_"), schema: req.jsonSchema, strict: false } },
        // OpenRouter usage accounting: the response's usage carries the cost in credits (USD).
        usage: { include: true },
      };
      const res = await client.chat.completions.create(params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
      const usage = res.usage as (OpenAI.Completions.CompletionUsage & { cost?: number }) | undefined;
      return {
        content: res.choices[0]?.message?.content ?? "",
        model: res.model,
        tokensIn: usage?.prompt_tokens ?? 0,
        tokensOut: usage?.completion_tokens ?? 0,
        costCents: typeof usage?.cost === "number" ? usage.cost * 100 : null,
        latencyMs: Date.now() - started,
        fixture: false,
      };
    },
    async embed(model: string, texts: string[]): Promise<EmbeddingResponse> {
      const res = await client.embeddings.create({ model, input: texts });
      const usage = res.usage as (OpenAI.Embeddings.CreateEmbeddingResponse.Usage & { cost?: number }) | undefined;
      return { vectors: res.data.map((d) => d.embedding), model: res.model, tokens: usage?.prompt_tokens ?? 0, costCents: typeof usage?.cost === "number" ? usage.cost * 100 : null, fixture: false };
    },
  };
}

interface FixtureFile {
  /** One recorded output, or one per attempt (to replay a retry). */
  output?: unknown;
  responses?: unknown[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export const FIXTURE_EMBED_DIMS = 256;

/**
 * Deterministic stand-in for embeddings in fixture mode: hashed bag of words (unigrams + bigrams), L2
 * normalised. Similarity is lexical, not semantic — good enough to exercise retrieval code paths offline.
 */
export function fixtureEmbedding(text: string): number[] {
  const v = new Array<number>(FIXTURE_EMBED_DIMS).fill(0);
  const words = text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const bump = (tok: string, w: number) => {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) h = Math.imul(h ^ tok.charCodeAt(i), 16777619);
    const idx = (h >>> 0) % FIXTURE_EMBED_DIMS;
    v[idx] = (v[idx] ?? 0) + w;
  };
  words.forEach((w, i) => { bump(w, 1); if (i > 0) bump(`${words[i - 1]} ${w}`, 0.5); });
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

/**
 * Fixture transport: replays recorded outputs from `<dir>/<taskId>/<fixtureHash>.json`. Unrecorded inputs
 * fail with `no_fixture` (never an invented answer) unless `fallback` allows `<taskId>/default.json`.
 */
export function fixtureTransport(dir: string, opts: { fallback?: boolean } = {}): Transport {
  return {
    kind: "fixture",
    async complete(req: CompletionRequest): Promise<CompletionResponse> {
      let file = join(dir, req.taskId, `${req.fixtureHash}.json`);
      if (!existsSync(file) && opts.fallback) file = join(dir, req.taskId, "default.json");
      if (!existsSync(file)) throw new AiError("no_fixture", `No recorded fixture for ${req.taskId} (${req.fixtureHash}). Record one with an OpenRouter key: npm run ai:record.`);
      const f = JSON.parse(readFileSync(file, "utf8")) as FixtureFile;
      const out = f.responses ? f.responses[Math.min(req.attempt, f.responses.length - 1)] : f.output;
      return { content: typeof out === "string" ? out : JSON.stringify(out), model: f.model ?? "fixture", tokensIn: f.tokensIn ?? 0, tokensOut: f.tokensOut ?? 0, costCents: 0, latencyMs: 0, fixture: true };
    },
    async embed(_model: string, texts: string[]): Promise<EmbeddingResponse> {
      return { vectors: texts.map(fixtureEmbedding), model: "fixture", tokens: 0, costCents: 0, fixture: true };
    },
  };
}
