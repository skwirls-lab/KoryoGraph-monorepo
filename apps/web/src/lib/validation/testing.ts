import { z } from "zod";

export const testingEventSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, { error: "Name the test" }).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date" }),
  time: z.string().regex(/^\d{2}:\d{2}$/, { error: "Pick a start time" }),
  durationMin: z.coerce.number().int().min(15).max(600).default(120),
  programIds: z.array(z.uuid()).min(1, { error: "Choose at least one program" }),
  fee: z.string().trim().default(""),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  capacity: z.union([z.coerce.number().int().min(1).max(1000), z.literal("")]).default(""),
  judgeIds: z.array(z.uuid()).default([]),
  notes: z.string().trim().max(2000).default(""),
});
export type TestingEventInput = z.input<typeof testingEventSchema>;
