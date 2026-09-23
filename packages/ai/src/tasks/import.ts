import { z } from "zod";
import type { AiTask } from "../types";

/** Import column mapping assist (A6 extension, M5.03). Sees header names and value *shapes* only — never data. */
export const importMappingInput = z.object({
  columns: z.array(z.object({
    header: z.string().max(120),
    shape: z.enum(["empty", "email", "date", "phone", "number", "yes_no", "text"]),
    filled: z.number().min(0).max(1),
  })).min(1).max(80),
  fields: z.array(z.object({ key: z.string(), label: z.string() })).min(1).max(40),
});
export type ImportMappingInput = z.infer<typeof importMappingInput>;
export const importMappingOutput = z.object({
  mapping: z.array(z.object({ header: z.string(), field: z.string().nullable(), confidence: z.number().min(0).max(1) })),
});

export const importMapping: AiTask<ImportMappingInput, z.infer<typeof importMappingOutput>> = {
  id: "import_mapping",
  tier: "fast",
  description: "Import: map spreadsheet columns to fields",
  input: importMappingInput,
  output: importMappingOutput,
  buildMessages: (i) => [
    { role: "system", content: `A martial arts school is importing its member list from a spreadsheet. Map each column to at most one of these fields (or null if none fits); use each field at most once. Fields: ${i.fields.map((f) => `${f.key} (${f.label})`).join("; ")}. You see only column names and the kind of values in them, not the values.` },
    { role: "user", content: i.columns.map((c) => `${c.header}: ${c.shape}, ${Math.round(c.filled * 100)}% filled`).join("\n") },
  ],
  maxCostCents: 1,
  temperature: 0,
  fixtureKey: (i) => ({ headers: i.columns.map((c) => c.header).sort() }),
  examples: [{ columns: [{ header: "Kid's name", shape: "text", filled: 1 }, { header: "Surname", shape: "text", filled: 1 }, { header: "Mum or Dad email", shape: "email", filled: 0.9 }, { header: "Belt colour", shape: "text", filled: 1 }], fields: [{ key: "first_name", label: "First name" }, { key: "last_name", label: "Last name" }, { key: "guardian_email", label: "Guardian email" }, { key: "rank", label: "Current rank" }] }],
};
