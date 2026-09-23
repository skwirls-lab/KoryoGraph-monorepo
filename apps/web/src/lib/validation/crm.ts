import { z } from "zod";

export const newLeadSchema = z.object({
  firstName: z.string().trim().min(1, { error: "First name is required" }).max(80),
  lastName: z.string().trim().max(80).default(""),
  email: z.email({ error: "Enter a valid email" }).or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  programIds: z.array(z.uuid()).default([]),
  source: z.string().trim().max(40).default("walk_in"),
  note: z.string().trim().max(2000).default(""),
}).refine((v) => v.email || v.phone, { error: "Give an email or a phone number", path: ["email"] });
export type NewLeadInput = z.input<typeof newLeadSchema>;

export const trialRequestSchema = z.object({
  firstName: z.string().trim().min(1, { error: "Your first name, please" }).max(80),
  lastName: z.string().trim().max(80).default(""),
  email: z.email({ error: "Enter a valid email" }).or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  programId: z.uuid().or(z.literal("")).default(""),
  sessionId: z.uuid().or(z.literal("")).default(""),
  message: z.string().trim().max(1000).default(""),
  website: z.string().max(200).default(""), // honeypot
  utm: z.record(z.string(), z.string().max(200)).default({}),
}).refine((v) => v.email || v.phone, { error: "Give an email or a phone number so we can reach you", path: ["email"] });
export type TrialRequestInput = z.input<typeof trialRequestSchema>;
