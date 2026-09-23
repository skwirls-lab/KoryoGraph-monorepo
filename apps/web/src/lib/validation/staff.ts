import { z } from "zod";

export const CERT_KINDS = {
  instructor_rank: "Instructor rank", cpr: "CPR", first_aid: "First aid", background_check: "Background check", safesport: "SafeSport", other: "Other",
} as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date" });
const optDate = date.or(z.literal("")).default("");
const time = z.string().regex(/^\d{2}:\d{2}$/, { error: "Pick a time" });
const money = z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, { error: "Enter an amount like 25.00" }).default("");

export const profileSchema = z.object({
  userId: z.uuid(),
  title: z.string().trim().max(80).default(""),
  programs: z.array(z.uuid()).max(50).default([]),
  hourly: money,
  perClass: money,
  commissionPct: z.string().trim().regex(/^(\d{1,2}(\.\d{1,2})?)?$/, { error: "A percentage like 10" }).default(""),
  hireDate: optDate,
  bio: z.string().trim().max(2000).default(""),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const certSchema = z.object({
  userId: z.uuid(),
  kind: z.enum(["instructor_rank", "cpr", "first_aid", "background_check", "safesport", "other"]),
  name: z.string().trim().max(120).default(""),
  issuer: z.string().trim().max(120).default(""),
  number: z.string().trim().max(60).default(""),
  issuedAt: optDate,
  expiresAt: optDate,
}).refine((v) => !v.issuedAt || !v.expiresAt || v.expiresAt >= v.issuedAt, { path: ["expiresAt"], error: "Expires before it was issued" });
export type CertInput = z.input<typeof certSchema>;

export const timeEntrySchema = z.object({
  userId: z.uuid(),
  date,
  clockIn: time,
  clockOut: time,
  notes: z.string().trim().max(200).default(""),
}).refine((v) => v.clockOut > v.clockIn, { path: ["clockOut"], error: "Ends before it starts" });
export type TimeEntryInput = z.input<typeof timeEntrySchema>;

export const shiftSchema = z.object({
  userId: z.uuid({ error: "Choose a staff member" }),
  date,
  start: time,
  end: time,
  roleLabel: z.string().trim().max(60).default(""),
}).refine((v) => v.end > v.start, { path: ["end"], error: "Ends before it starts" });
export type ShiftInput = z.input<typeof shiftSchema>;

export const taskSchema = z.object({
  title: z.string().trim().min(2, { error: "What needs doing?" }).max(200),
  body: z.string().trim().max(2000).default(""),
  assigneeUserId: z.uuid().or(z.literal("")).default(""),
  dueDate: optDate,
  personId: z.uuid().or(z.literal("")).default(""),
});
export type TaskInput = z.input<typeof taskSchema>;

/** "YYYY-MM" for the month containing `date` (YYYY-MM-DD), shifted by `delta` months. */
export function monthOf(date: string, delta = 0): string {
  const [y, m] = date.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
