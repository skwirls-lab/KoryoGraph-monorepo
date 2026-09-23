import { z } from "zod";
import type { AiTask } from "../types";

// ---------------------------------------------------------------- A8 Billing recovery
export const billingRecoveryInput = z.object({
  school: z.string(),
  stage: z.number().int().min(1).max(3),
  daysOverdue: z.number().int().min(0),
  tenureMonths: z.number().int().min(0),
  previousFailures: z.number().int().min(0),
  cardOnFile: z.boolean(),
});
export type BillingRecoveryInput = z.infer<typeof billingRecoveryInput>;
export const billingRecoveryOutput = z.object({
  tone: z.enum(["gentle", "firm", "final"]),
  /** Placeholders: {{first_name}} (recipient), {{amount}}, {{link}}. */
  sms: z.string().min(10).max(320),
  emailSubject: z.string().min(3).max(120),
  emailBody: z.string().min(20).max(2000),
});
export type BillingRecoveryOutput = z.infer<typeof billingRecoveryOutput>;

export const billingRecovery: AiTask<BillingRecoveryInput, BillingRecoveryOutput> = {
  id: "billing_recovery",
  tier: "fast",
  description: "Billing recovery: tone-adjusted payment follow-up",
  input: billingRecoveryInput,
  output: billingRecoveryOutput,
  buildMessages: (i) => [
    { role: "system", content: `Write a payment follow-up for ${i.school}, a martial arts school, to a family whose payment failed. Step ${i.stage} of 3 (${i.stage === 1 ? "friendly heads-up" : i.stage === 2 ? "clear reminder" : "final notice before the membership is paused"}). ${i.tenureMonths >= 12 ? "They've been members for over a year — be warm and appreciative." : "They're fairly new members."} ${i.cardOnFile ? "They have a card on file; mention they can update it." : "They have no card on file."} Use only these placeholders: {{first_name}}, {{amount}}, {{link}}. Never threaten; never mention other families; no late fees.` },
    { role: "user", content: `Overdue ${i.daysOverdue} days; ${i.previousFailures} failed attempts so far.` },
  ],
  maxCostCents: 3,
  temperature: 0.4,
  fixtureKey: (i) => ({ stage: i.stage, established: i.tenureMonths >= 12 }),
};

// ---------------------------------------------------------------- A9 Parent narratives
export const parentNarrativeInput = z.object({
  school: z.string(),
  student: z.string(),
  classes: z.number().int().min(0),
  skills: z.array(z.string()).max(12),
  promotion: z.string().nullable(),
  instructorNotes: z.array(z.string().max(300)).max(5),
});
export type ParentNarrativeInput = z.infer<typeof parentNarrativeInput>;
export const parentNarrativeOutput = z.object({
  /** Placeholders: {{student}}, {{classes}}, {{skills}}, {{promotion}} — filled with the real facts. */
  body: z.string().min(20).max(1200),
});

export const parentNarrative: AiTask<ParentNarrativeInput, z.infer<typeof parentNarrativeOutput>> = {
  id: "parent_narrative",
  tier: "fast",
  description: "Parent narrative: weekly plain-language progress update",
  input: parentNarrativeInput,
  output: parentNarrativeOutput,
  buildMessages: (i) => [
    { role: "system", content: `Write a short, warm weekly update from ${i.school} to a parent about their child's martial arts training: 2–4 sentences, specific and encouraging, no jargon, no promises about promotions. Use the placeholders {{student}}, {{classes}}, {{skills}} and {{promotion}} for the facts (they'll be filled in); don't restate facts that aren't given.` },
    { role: "user", content: `Classes this week: ${i.classes}. Skills signed off: ${i.skills.join(", ") || "none"}. Promotion: ${i.promotion ?? "none"}. Instructor notes: ${i.instructorNotes.join(" | ") || "none"}.` },
  ],
  maxCostCents: 2,
  temperature: 0.5,
  fixtureKey: (i) => ({ classes: i.classes === 0 ? "0" : i.classes <= 2 ? "1-2" : "3+", skills: i.skills.length > 0, promoted: Boolean(i.promotion) }),
};

// ---------------------------------------------------------------- A10 Lead scoring + next action
export interface LeadSignals {
  stage: string;
  source: string | null;
  hasMessage: boolean;
  daysOld: number;
  activities: number;
  trialBooked: boolean;
  trialAttended: boolean;
  lastTouchDays: number | null;
}

/** Transparent lead score 0–100 (the AI only suggests the next step). */
export function scoreLead(s: LeadSignals): { score: number; reasons: string[] } {
  let score = 20;
  const reasons: string[] = [];
  if (s.trialAttended) { score += 35; reasons.push("attended a trial"); } else if (s.trialBooked) { score += 20; reasons.push("trial booked"); }
  if (s.stage === "offer") { score += 15; reasons.push("offer made"); }
  if (s.source === "referral") { score += 15; reasons.push("referred"); } else if (s.source === "website" || s.source === "google") { score += 5; reasons.push(`found us via ${s.source}`); }
  if (s.hasMessage) { score += 5; reasons.push("wrote a message"); }
  if (s.activities >= 3) { score += 5; reasons.push("several touches"); }
  if (s.lastTouchDays !== null && s.lastTouchDays > 14) { score -= 15; reasons.push(`no contact in ${s.lastTouchDays} days`); }
  if (s.daysOld > 45 && !s.trialAttended) { score -= 10; reasons.push("older lead"); }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export const leadNextActionInput = z.object({
  school: z.string(),
  stage: z.string(),
  trialBooked: z.boolean(),
  trialAttended: z.boolean(),
  hasMessage: z.boolean(),
  lastTouchDays: z.number().int().nullable(),
  score: z.number().int(),
});
export type LeadNextActionInput = z.infer<typeof leadNextActionInput>;
export const leadNextActionOutput = z.object({ nextAction: z.string().min(5).max(140) });

export const leadNextAction: AiTask<LeadNextActionInput, z.infer<typeof leadNextActionOutput>> = {
  id: "lead_next_action",
  tier: "fast",
  description: "Lead scoring: suggested next step",
  input: leadNextActionInput,
  output: leadNextActionOutput,
  buildMessages: (i) => [
    { role: "system", content: `Suggest the single best next step for the front desk of ${i.school} with this sales lead, in under 15 words, imperative mood.` },
    { role: "user", content: JSON.stringify(i) },
  ],
  maxCostCents: 1,
  temperature: 0.3,
  fixtureKey: (i) => ({ stage: i.stage, trialBooked: i.trialBooked, trialAttended: i.trialAttended, stale: (i.lastTouchDays ?? 0) > 14 }),
};
