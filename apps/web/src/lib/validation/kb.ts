import { z } from "zod";

export const KB_KINDS = { policy: "Policy", faq: "FAQ", curriculum: "Curriculum", schedule_digest: "Schedule digest", other: "Other" } as const;

export const kbDocSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2, { error: "Give it a title" }).max(160),
  kind: z.enum(["policy", "faq", "curriculum", "other"]),
  audience: z.enum(["everyone", "staff"]),
  body: z.string().trim().min(20, { error: "Add the text families or staff should get answers from" }).max(100_000),
});
export type KbDocInput = z.input<typeof kbDocSchema>;
