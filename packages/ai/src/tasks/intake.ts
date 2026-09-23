import { z } from "zod";
import type { AiTask } from "../types";

export const packingSlipInput = z.object({
  mime: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
  base64: z.string().min(100),
  sha256: z.string().length(64),
  fileName: z.string().max(200),
});
export type PackingSlipInput = z.infer<typeof packingSlipInput>;

export const packingSlipOutput = z.object({
  supplier: z.string().max(120).nullable(),
  reference: z.string().max(80).nullable(),
  lines: z.array(z.object({
    description: z.string().min(1).max(200),
    skuText: z.string().max(60).nullable(),
    quantity: z.number().int().min(0).max(10_000),
    unitCostCents: z.number().int().min(0).max(1_000_000).nullable(),
  })).min(1).max(100),
});
export type PackingSlipOutput = z.infer<typeof packingSlipOutput>;

/** Packing slip / supplier invoice (image or PDF) → structured receive lines (vision tier, A6). */
export const packingSlip: AiTask<PackingSlipInput, PackingSlipOutput> = {
  id: "packing_slip",
  tier: "vision",
  description: "Document intake: read a packing slip",
  input: packingSlipInput,
  output: packingSlipOutput,
  buildMessages: (i) => [{ role: "user", content: [
    { type: "text", text: "Read this supplier packing slip or invoice. Return the supplier name, the order/invoice reference, and every product line with the quantity shipped (not ordered, if both appear), the supplier's item code if printed, and the unit cost in cents if printed. Skip totals, tax and shipping lines." },
    i.mime === "application/pdf"
      ? { type: "file", file: { filename: i.fileName || "slip.pdf", file_data: `data:application/pdf;base64,${i.base64}` } }
      : { type: "image_url", image_url: { url: `data:${i.mime};base64,${i.base64}` } },
  ] }],
  maxCostCents: 15,
  temperature: 0,
  fixtureKey: (i) => ({ sha256: i.sha256 }),
};
