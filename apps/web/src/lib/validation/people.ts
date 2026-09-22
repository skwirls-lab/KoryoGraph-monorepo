import { z } from "zod";
import { CONSENT_KINDS, NOTE_KINDS, PERSON_STATUSES } from "../people";

const optionalText = z.string().trim().max(200).optional().or(z.literal(""));
const optionalEmail = z.email({ error: "Enter a valid email" }).trim().toLowerCase().optional().or(z.literal(""));
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use YYYY-MM-DD" });

export const guardianInput = z.object({
  firstName: z.string().trim().min(1, { error: "First name is required" }).max(80),
  lastName: z.string().trim().min(1, { error: "Last name is required" }).max(80),
  email: optionalEmail,
  phone: optionalText,
  emailConsent: z.boolean().default(false),
  smsConsent: z.boolean().default(false),
});

export const studentInput = z.object({
  firstName: z.string().trim().min(1, { error: "First name is required" }).max(80),
  lastName: z.string().trim().min(1, { error: "Last name is required" }).max(80),
  dob: dateString.optional().or(z.literal("")),
  allergies: optionalText,
  status: z.enum(["active", "trial", "lead"]).default("active"),
  consents: z.object(Object.fromEntries(CONSENT_KINDS.map((k) => [k, z.boolean().default(false)])) as Record<(typeof CONSENT_KINDS)[number], z.ZodDefault<z.ZodBoolean>>),
});

export const newHouseholdSchema = z
  .object({
    householdName: z.string().trim().min(2, { error: "Name the household (e.g. “Cooper family”)" }).max(120),
    guardians: z.array(guardianInput).max(6),
    students: z.array(studentInput).max(10),
  })
  .refine((v) => v.guardians.length + v.students.length > 0, { error: "Add at least one person", path: ["students"] });
export type NewHouseholdInput = z.input<typeof newHouseholdSchema>;

export const updatePersonSchema = z.object({
  id: z.uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80),
  preferredName: optionalText,
  dob: dateString.optional().or(z.literal("")),
  email: optionalEmail,
  phone: optionalText,
  emailConsent: z.boolean(),
  smsConsent: z.boolean(),
  allergies: optionalText,
  injuryFlags: optionalText,
  uniformSize: optionalText,
  beltSize: optionalText,
});
export type UpdatePersonInput = z.input<typeof updatePersonSchema>;

export const statusChangeSchema = z.object({
  id: z.uuid(),
  status: z.enum(PERSON_STATUSES),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const noteSchema = z.object({
  personId: z.uuid(),
  kind: z.enum(NOTE_KINDS).default("general"),
  body: z.string().trim().min(1, { error: "Write something" }).max(5000),
});
export type NoteInput = z.input<typeof noteSchema>;

export const medicalSchema = z.object({ personId: z.uuid(), notes: z.string().max(10_000) });

export const tagsSchema = z.object({
  personIds: z.array(z.uuid()).min(1).max(500),
  tag: z.string().trim().toLowerCase().min(1).max(40).regex(/^[a-z0-9][a-z0-9 _-]*$/, { error: "Letters, numbers, spaces, - and _" }),
});

export const consentSchema = z.object({ personId: z.uuid(), kind: z.enum(CONSENT_KINDS), granted: z.boolean() });

export const householdMemberSchema = z.object({
  householdId: z.uuid(),
  personId: z.uuid(),
  relationship: z.enum(["guardian", "student", "other"]),
});

export const householdUpdateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  billingEmail: optionalEmail,
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const pinSchema = z.object({ householdId: z.uuid(), pin: z.string().regex(/^\d{4}$/, { error: "4 digits" }) });

/** "peanuts, bees" → ["peanuts", "bees"] */
export function splitList(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const newMemberSchema = z.object({
  householdId: z.uuid(),
  relationship: z.enum(["guardian", "student", "other"]),
  firstName: z.string().trim().min(1, { error: "First name is required" }).max(80),
  lastName: z.string().trim().min(1, { error: "Last name is required" }).max(80),
  dob: dateString.optional().or(z.literal("")),
  email: optionalEmail,
  phone: optionalText,
});
export type NewMemberInput = z.input<typeof newMemberSchema>;
