import type { z } from "zod";

/** Capability tiers; each maps to a model chosen per deployment (AI_MODEL_FAST, …). */
export const TIERS = ["fast", "frontier", "vision", "audio", "embed"] as const;
export type Tier = (typeof TIERS)[number];

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: "wav" | "mp3" } }
  | { type: "file"; file: { filename: string; file_data: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

/** A registered AI task: typed input and output, the prompt, and a cost ceiling per run. */
export interface AiTask<I = unknown, O = unknown> {
  id: string;
  tier: Exclude<Tier, "embed">;
  description: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  buildMessages(input: I): ChatMessage[];
  /** Upper bound for one run, used by the budget check before calling out. */
  maxCostCents: number;
  temperature?: number;
  /** Which part of the input identifies a recorded fixture (default: the whole input). */
  fixtureKey?(input: I): unknown;
  /** Sample inputs for `ai:eval` / `ai:record`. */
  examples?: I[];
}

export interface CompletionRequest {
  taskId: string;
  model: string;
  messages: ChatMessage[];
  jsonSchema: Record<string, unknown>;
  temperature?: number;
  fixtureHash: string;
  /** 0 on the first attempt, 1 on the retry after invalid output. */
  attempt: number;
}

export interface CompletionResponse {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** Provider-reported cost when available (OpenRouter usage accounting), else null. */
  costCents: number | null;
  latencyMs: number;
  fixture: boolean;
}

export interface EmbeddingResponse {
  vectors: number[][];
  model: string;
  tokens: number;
  costCents: number | null;
  fixture: boolean;
}

export interface Transport {
  kind: "live" | "fixture";
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  embed(model: string, texts: string[]): Promise<EmbeddingResponse>;
}

export type AiRunStatus = "ok" | "invalid_output" | "provider_error" | "no_key" | "no_model" | "budget_exceeded" | "no_fixture";

export interface AiRunRecord {
  tenantId: string;
  userId: string | null;
  taskId: string;
  tier: Tier;
  model: string | null;
  transport: "live" | "fixture";
  status: AiRunStatus;
  inputHash: string;
  input: unknown;
  output: unknown;
  error: string | null;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  latencyMs: number;
  attempts: number;
}

/** Persistence the gateway needs; the app implements it over the database (ai_runs, budgets, prices). */
export interface AiStore {
  budget(tenantId: string): Promise<{ limitCents: number; usedCents: number } | null>;
  /** Price per 1M tokens for a model, if known (fallback when the provider doesn't report cost). */
  price(model: string): Promise<{ inputPerM: number; outputPerM: number } | null>;
  logRun(run: AiRunRecord): Promise<string | null>;
}

export type AiErrorCode = Exclude<AiRunStatus, "ok">;

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string, public runId: string | null = null) {
    super(message);
    this.name = "AiError";
  }
}
