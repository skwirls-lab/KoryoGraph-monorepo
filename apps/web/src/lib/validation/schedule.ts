import { z } from "zod";
import { WEEKDAYS } from "@koryo/scheduling";

const time = z.string().regex(/^\d{2}:\d{2}$/, { error: "Use HH:MM" });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date" });
const optInt = (min: number, max: number) => z.union([z.literal(""), z.coerce.number().int().min(min).max(max)]).optional();

export const templateSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, { error: "Name the class" }).max(80),
    locationId: z.uuid(),
    programIds: z.array(z.uuid()).max(10),
    days: z.array(z.enum(WEEKDAYS)).min(1, { error: "Pick at least one day" }),
    interval: z.coerce.number().int().min(1).max(4).default(1),
    startTime: time,
    durationMin: z.coerce.number().int().min(10).max(300),
    startDate: date,
    untilDate: date.optional().or(z.literal("")),
    capacity: optInt(1, 500),
    instructorIds: z.array(z.uuid()).max(10),
    rankMin: optInt(1, 50),
    rankMax: optInt(1, 50),
    ageMin: optInt(0, 120),
    ageMax: optInt(0, 120),
    room: z.string().trim().max(60).optional().or(z.literal("")),
    bookable: z.boolean().default(false),
    cancellationWindowMin: z.coerce.number().int().min(0).max(10_080).default(120),
  })
  .refine((v) => !v.untilDate || v.untilDate >= v.startDate, { error: "End date is before the start date", path: ["untilDate"] });
export type TemplateInput = z.input<typeof templateSchema>;

export const cancelSessionSchema = z.object({
  sessionId: z.uuid(),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
  notify: z.boolean().default(true),
});

export const holidaySchema = z.object({
  date,
  name: z.string().trim().min(2).max(80),
  locationId: z.uuid().optional().or(z.literal("")),
});
