import { z } from "zod";

export const PLAN_KINDS = ["recurring", "contract", "paid_in_full", "class_pack", "drop_in", "trial"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_KIND_LABELS: Record<PlanKind, string> = {
  recurring: "Recurring",
  contract: "Contract",
  paid_in_full: "Paid in full",
  class_pack: "Class pack",
  drop_in: "Drop-in",
  trial: "Trial",
};

const money = z.string().trim().regex(/^\$?\d{1,6}(,\d{3})*(\.\d{1,2})?$|^$/, { error: "Enter an amount like 149 or 149.00" });
const optInt = (min: number, max: number) => z.union([z.coerce.number().int().min(min).max(max), z.literal("")]);
const pct = z.coerce.number().int({ error: "Whole percent" }).min(0).max(100);

export const planSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, { error: "Name the plan" }).max(80),
    description: z.string().trim().max(500).default(""),
    kind: z.enum(PLAN_KINDS),
    interval: z.enum(["week", "month", "year"]).or(z.literal("")),
    intervalCount: z.coerce.number().int().min(1).max(12).default(1),
    price: money.refine((v) => v !== "", { error: "Enter a price" }),
    enrollmentFee: money.default(""),
    contractMonths: optInt(1, 60).default(""),
    earlyTerminationFee: money.default(""),
    autoRenew: z.boolean().default(true),
    termMonths: optInt(1, 60).default(""),
    classPackSize: optInt(1, 500).default(""),
    trialDays: optInt(1, 90).default(""),
    programIds: z.array(z.uuid()).max(50).default([]),
    unlimited: z.boolean().default(true),
    classesPerWeek: optInt(1, 14).default(""),
    secondPct: pct.default(0),
    thirdPlusPct: pct.default(0),
    taxClass: z.string().trim().min(1).max(40).default("exempt"),
    gearProductIds: z.array(z.uuid()).max(20).default([]),
    isPublic: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    const recurring = v.kind === "recurring" || v.kind === "contract";
    if (recurring && !v.interval) ctx.addIssue({ code: "custom", path: ["interval"], message: "Choose how often it bills" });
    if (v.kind === "contract" && v.contractMonths === "") ctx.addIssue({ code: "custom", path: ["contractMonths"], message: "Contract length is required" });
    if (v.kind === "paid_in_full" && v.termMonths === "") ctx.addIssue({ code: "custom", path: ["termMonths"], message: "How many months does it cover?" });
    if (v.kind === "class_pack" && v.classPackSize === "") ctx.addIssue({ code: "custom", path: ["classPackSize"], message: "How many classes?" });
    if (v.kind === "trial" && v.trialDays === "") ctx.addIssue({ code: "custom", path: ["trialDays"], message: "How many days?" });
    if (!v.unlimited && v.classesPerWeek === "") ctx.addIssue({ code: "custom", path: ["classesPerWeek"], message: "Classes per week, or tick unlimited" });
  });
export type PlanInput = z.input<typeof planSchema>;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date" });

export const enrollmentQuoteSchema = z.object({
  personId: z.uuid(),
  householdId: z.uuid(),
  planId: z.uuid({ error: "Choose a plan" }),
  startsAt: dateStr,
  billingDay: z.coerce.number().int().min(1).max(28),
  couponCode: z.string().trim().max(40).default(""),
  gear: z.record(z.string(), z.string()).default({}),
});
export type EnrollmentQuoteInput = z.input<typeof enrollmentQuoteSchema>;

export const enrollmentSchema = enrollmentQuoteSchema.extend({
  payment: z.discriminatedUnion("method", [
    z.object({ method: z.literal("card"), paymentMethodId: z.uuid({ error: "Choose a card" }), attemptKey: z.uuid() }),
    z.object({ method: z.literal("cash") }),
    z.object({ method: z.literal("check"), reference: z.string().trim().max(40).default("") }),
    z.object({ method: z.literal("later") }),
  ]),
  autopay: z.boolean().default(false),
  contractSignature: z.string().trim().max(120).default(""),
  notes: z.string().trim().max(500).default(""),
});
export type EnrollmentInput = z.input<typeof enrollmentSchema>;
