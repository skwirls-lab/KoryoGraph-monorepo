import { z } from "zod";

export const APPROVAL_KINDS = {
  drift_outreach: "At-risk outreach", billing_recovery: "Payment follow-up", parent_narrative: "Parent update", action_board: "Action board",
  doc_intake: "Document intake", vision_feedback: "Technique feedback", copilot_write: "Copilot action", other: "Other",
} as const;
export type ApprovalKind = keyof typeof APPROVAL_KINDS;

/** Kinds whose payload is a message to a student's family (edited as text before it goes out). */
export const MESSAGE_KINDS: ApprovalKind[] = ["drift_outreach", "billing_recovery", "copilot_write"];

export const messagePayloadSchema = z.object({
  person_id: z.uuid(),
  messages: z.array(z.object({
    channel: z.enum(["email", "sms"]),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(2, { error: "The message is empty" }).max(4000),
  })).min(1).max(2),
});
export type MessagePayload = z.infer<typeof messagePayloadSchema>;

/** A weekly family update (A9): published to Home as written (staff may edit it first). */
export const narrativePayloadSchema = z.object({
  person_id: z.uuid(),
  week_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z.string().trim().min(10, { error: "The update is too short" }).max(2000),
});
export type NarrativePayload = z.infer<typeof narrativePayloadSchema>;
