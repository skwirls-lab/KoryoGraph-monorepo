import { z } from "zod";

export const intakePayloadSchema = z.object({
  file_path: z.string(),
  supplier_id: z.uuid().nullable(),
  supplier_text: z.string().nullable(),
  reference: z.string().nullable(),
  location_id: z.uuid().nullable(),
  lines: z.array(z.object({
    description: z.string(),
    sku_text: z.string().nullable(),
    quantity: z.number().int().min(0),
    unit_cost_cents: z.number().int().nullable(),
    variant_id: z.uuid().nullable(),
    variant_label: z.string().nullable(),
    confidence: z.number(),
    include: z.boolean(),
  })),
});
export type IntakePayload = z.infer<typeof intakePayloadSchema>;
export const INTAKE_CONFIDENT = 0.6;
