import { z } from "zod";

export const WEEKDAYS = [
  { value: 1, short: "Mon", label: "Monday" }, { value: 2, short: "Tue", label: "Tuesday" }, { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" }, { value: 5, short: "Fri", label: "Friday" }, { value: 6, short: "Sat", label: "Saturday" }, { value: 7, short: "Sun", label: "Sunday" },
] as const;

/** One name per line or comma. */
export const splitList = (s: string): string[] => [...new Set(s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean))];

export const programSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, { error: "Name the program" }).max(120),
  weeklyPrice: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, { error: "Enter an amount like 95.00" }),
  schools: z.string().trim().refine((s) => splitList(s).length > 0, { error: "List at least one school" }),
  routes: z.string().trim().default(""),
  days: z.array(z.number().int().min(1).max(7)).min(1, { error: "Choose the days it runs" }),
  cutoff: z.string().regex(/^\d{2}:\d{2}$/, { error: "Pick a time" }),
});
export type ProgramInput = z.input<typeof programSchema>;

export const enrollSchema = z.object({
  programId: z.uuid(),
  personId: z.uuid({ error: "Choose a child" }),
  school: z.string().trim().min(1, { error: "Choose a school" }),
  route: z.string().trim().default(""),
  days: z.array(z.number().int().min(1).max(7)).min(1, { error: "Choose days" }),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a start date" }),
});
export type EnrollInput = z.input<typeof enrollSchema>;

export const markSchema = z.object({
  enrollmentId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["picked_up", "arrived", "released", "absent", "present"]),
  releasedTo: z.string().trim().max(120).default(""),
  reason: z.string().trim().max(200).default(""),
  /** PNG data URL from the signature pad (release only). */
  signature: z.string().max(400_000).default(""),
});
export type MarkInput = z.input<typeof markSchema>;

/** ISO weekday (1 = Monday) of a YYYY-MM-DD date. */
export function isoDow(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
