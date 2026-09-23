import { z } from "zod";
import type { AiTask } from "../types";

export const driftOutreachInput = z.object({
  school: z.string(),
  studentFirstName: z.string(),
  minor: z.boolean(),
  level: z.enum(["low", "medium", "high"]),
  reasons: z.array(z.object({ factor: z.string(), detail: z.string() })).min(1).max(6),
});
export type DriftOutreachInput = z.infer<typeof driftOutreachInput>;

export const driftOutreachOutput = z.object({
  /** For staff: why this student is flagged, in a sentence or two. */
  explanation: z.string().min(10).max(600),
  /** Text message; {{first_name}} = the recipient, {{student}} = the student. */
  sms: z.string().min(10).max(320),
  emailSubject: z.string().min(3).max(120),
  emailBody: z.string().min(20).max(2000),
});
export type DriftOutreachOutput = z.infer<typeof driftOutreachOutput>;

export const driftOutreach: AiTask<DriftOutreachInput, DriftOutreachOutput> = {
  id: "drift_outreach",
  tier: "fast",
  description: "Drift Detector: explain a student's risk and draft a caring check-in",
  input: driftOutreachInput,
  output: driftOutreachOutput,
  buildMessages: (i) => [
    { role: "system", content: `You write for ${i.school}, a martial arts school. A student may be drifting away. Write (1) a short factual explanation for staff, and (2) a warm, low-pressure check-in to ${i.minor ? "the student's parent or guardian" : "the student"}: no guilt, no discounts unless asked, invite them back and offer help (different class time, a chat). Use the placeholders {{first_name}} for the person you're writing to and {{student}} for the student's first name — never other names. Never mention money owed in the outreach; staff see that in the explanation.` },
    { role: "user", content: `Risk level: ${i.level}. Signals:\n${i.reasons.map((r) => `- ${r.detail}`).join("\n")}` },
  ],
  maxCostCents: 3,
  temperature: 0.5,
  // Drafts depend on the kind of signals, not on the person — a handful of recordings cover everyone.
  fixtureKey: (i) => ({ factors: [...new Set(i.reasons.map((r) => r.factor))].sort(), minor: i.minor }),
  examples: [{ school: "Ridgeline Taekwondo", studentFirstName: "Riley", minor: true, level: "high", reasons: [{ factor: "attendance_drop", detail: "Attendance fell from 2.4 to 0.5 classes a week" }, { factor: "absent", detail: "No class in 16 days" }] }],
};
