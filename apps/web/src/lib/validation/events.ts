import { z } from "zod";

export const EVENT_KINDS = { camp: "Camp", event: "Event", party: "Birthday party", seminar: "Seminar", tournament: "Tournament", ceremony: "Ceremony" } as const;
export type EventKind = keyof typeof EVENT_KINDS;
export const PRICE_PER = { person: "per person", day: "per day", week: "per week" } as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date" });
const time = z.string().regex(/^\d{2}:\d{2}$/, { error: "Pick a time" });

export const priceOptionSchema = z.object({
  label: z.string().trim().min(1, { error: "Name the option" }).max(60),
  price: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, { error: "Enter an amount like 40.00" }),
  per: z.enum(["person", "day", "week"]),
});

/** The event wizard: kind → dates → pricing → capacity & waivers (→ party host and deposit). */
export const eventSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(["event", "camp", "party", "seminar", "tournament", "ceremony"]),
  name: z.string().trim().min(2, { error: "Name the event" }).max(120),
  description: z.string().trim().max(4000).default(""),
  startDate: date,
  endDate: date,
  startTime: time,
  endTime: time,
  weekdaysOnly: z.boolean().default(true),
  pricing: z.array(priceOptionSchema).max(8).default([]),
  capacity: z.union([z.coerce.number().int().min(1).max(2000), z.literal("")]).default(""),
  waiverIds: z.array(z.uuid()).max(5).default([]),
  closesDate: date.or(z.literal("")).default(""),
  hostHouseholdId: z.uuid().or(z.literal("")).default(""),
  deposit: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, { error: "Enter an amount like 100.00" }).default(""),
}).superRefine((v, c) => {
  if (v.endDate < v.startDate) c.addIssue({ code: "custom", path: ["endDate"], message: "Ends before it starts" });
  if (v.startDate === v.endDate && v.endTime <= v.startTime) c.addIssue({ code: "custom", path: ["endTime"], message: "Ends before it starts" });
  if (v.kind !== "party" && !v.pricing.length) c.addIssue({ code: "custom", path: ["pricing"], message: "Add at least one price option (0.00 for free)" });
  if (new Set(v.pricing.map((p) => p.label.toLowerCase())).size !== v.pricing.length) c.addIssue({ code: "custom", path: ["pricing"], message: "Option names must differ" });
});
export type EventInput = z.input<typeof eventSchema>;

export const registerSchema = z.object({
  eventId: z.uuid(),
  personId: z.uuid(),
  option: z.string().trim().min(1, { error: "Choose a price option" }),
  dayIds: z.array(z.uuid()).default([]),
  allergiesAck: z.boolean().default(false),
  notes: z.string().trim().max(500).default(""),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const guestWaiverSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/),
  guestName: z.string().trim().min(2, { error: "Guest's name" }).max(120),
  guestDob: date.or(z.literal("")).default(""),
  guardianName: z.string().trim().min(2, { error: "Parent or guardian's name" }).max(120),
  guardianPhone: z.string().trim().max(40).default(""),
  typedSignature: z.string().trim().min(2, { error: "Type your full name to sign" }).max(120),
  agree: z.literal(true, { error: "Tick the box to agree" }),
});
export type GuestWaiverInput = z.input<typeof guestWaiverSchema>;

/** Price of an option for a number of days (mirrors app.event_price). */
export function priceFor(option: { price_cents: number; per: string }, days: number): number {
  if (option.per === "day") return option.price_cents * Math.max(days, 1);
  if (option.per === "week") return option.price_cents * Math.max(Math.ceil(days / 5), 1);
  return option.price_cents;
}

/** Calendar dates from start to end inclusive (YYYY-MM-DD), optionally skipping Saturdays and Sundays. */
export function eventDates(start: string, end: string, weekdaysOnly: boolean): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (d <= last && out.length < 62) {
    const dow = d.getUTCDay();
    if (!weekdaysOnly || (dow !== 0 && dow !== 6)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export interface PriceOption { label: string; price_cents: number; per: "person" | "day" | "week" }
export function parsePricing(v: unknown): PriceOption[] {
  const parsed = z.array(z.object({ label: z.string(), price_cents: z.number().int(), per: z.enum(["person", "day", "week"]) })).safeParse(v);
  return parsed.success ? parsed.data : [];
}
