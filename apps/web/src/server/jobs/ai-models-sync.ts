import { OPENROUTER_BASE_URL } from "@koryo/ai";
import { z } from "zod";
import type { Job, JobStats } from "./types";

const catalogue = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    context_length: z.number().nullish(),
    pricing: z.object({ prompt: z.string(), completion: z.string() }).partial().optional(),
  })),
});

/** Refresh model prices (USD per token → cents per 1M tokens) from the provider's public catalogue. */
export const aiModelsSync: Job = async ({ db, log }) => {
  const res = await fetch(`${OPENROUTER_BASE_URL}/models`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`catalogue: HTTP ${res.status}`);
  const parsed = catalogue.parse(await res.json());
  const rows = parsed.data.map((m) => ({
    id: m.id, name: m.name ?? null, context_length: m.context_length ?? null, synced_at: new Date().toISOString(),
    input_per_m_cents: Number(m.pricing?.prompt ?? 0) * 1_000_000 * 100, output_per_m_cents: Number(m.pricing?.completion ?? 0) * 1_000_000 * 100,
  })).filter((r) => Number.isFinite(r.input_per_m_cents) && Number.isFinite(r.output_per_m_cents) && r.input_per_m_cents >= 0 && r.output_per_m_cents >= 0);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("ai_models").upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(`ai_models: ${error.message}`);
  }
  log.info({ models: rows.length }, "ai models synced");
  const stats: JobStats = { models: rows.length };
  return stats;
};
