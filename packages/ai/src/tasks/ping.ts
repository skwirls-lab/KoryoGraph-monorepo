import { z } from "zod";
import type { AiTask } from "../types";

/** Connection check: the smallest structured-output round trip. */
export const ping: AiTask<{ word: string }, { ok: true; echo: string }> = {
  id: "ping",
  tier: "fast",
  description: "Connection check (structured output round trip)",
  input: z.object({ word: z.string().min(1).max(40) }),
  output: z.object({ ok: z.literal(true), echo: z.string() }),
  buildMessages: ({ word }) => [{ role: "user", content: `Return {"ok": true, "echo": "${word}"}.` }],
  maxCostCents: 1,
  temperature: 0,
  examples: [{ word: "koryograph" }],
};
