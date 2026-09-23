import { z } from "zod";
import type { AiTask } from "../types";

/** Read-only tools the Desk copilot may call (executed as the signed-in staff member, under RLS). */
export const REPORT_KEYS = ["past_due", "past_due_absent", "active_students", "attendance_by_week", "mrr", "trials"] as const;

const toolCall = z.discriminatedUnion("tool", [
  z.object({ type: z.literal("tool"), tool: z.literal("find_person"), args: z.object({ query: z.string().min(1).max(80) }) }),
  z.object({ type: z.literal("tool"), tool: z.literal("person_summary"), args: z.object({ person_id: z.string().uuid() }) }),
  z.object({ type: z.literal("tool"), tool: z.literal("attendance_summary"), args: z.object({ person_id: z.string().uuid(), weeks: z.number().int().min(1).max(52) }) }),
  z.object({ type: z.literal("tool"), tool: z.literal("invoices_for_household"), args: z.object({ household_id: z.string().uuid() }) }),
  z.object({ type: z.literal("tool"), tool: z.literal("run_report"), args: z.object({ key: z.enum(REPORT_KEYS), weeks: z.number().int().min(1).max(52).optional() }) }),
  z.object({ type: z.literal("tool"), tool: z.literal("kb_search"), args: z.object({ query: z.string().min(2).max(200) }) }),
  z.object({ type: z.literal("tool"), tool: z.literal("propose_action"), args: z.object({
    person_id: z.string().uuid(), channel: z.enum(["email", "sms"]), subject: z.string().max(200).optional(), body: z.string().min(2).max(2000), reason: z.string().max(300),
  }) }),
  z.object({ type: z.literal("tool"), tool: z.literal("propose_messages"), args: z.object({
    report: z.enum(["past_due", "past_due_absent"]), channel: z.enum(["email", "sms"]), subject: z.string().max(200).optional(), body: z.string().min(2).max(2000), reason: z.string().max(300),
  }) }),
]);

export const citationSchema = z.object({
  kind: z.enum(["person", "household", "invoice", "report", "kb", "approval"]),
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
});

const answer = z.object({
  type: z.literal("answer"),
  /** May quote tool results with {{obs.N.path}} placeholders; the server fills them from the real data. */
  text: z.string().min(1).max(4000),
  citations: z.array(citationSchema).max(12),
});

export const copilotStepOutput = z.union([toolCall, answer]);
export type CopilotStep = z.infer<typeof copilotStepOutput>;
export type CopilotToolCall = z.infer<typeof toolCall>;
export type Citation = z.infer<typeof citationSchema>;

export const copilotStepInput = z.object({
  question: z.string().trim().min(1).max(2000),
  school: z.string(),
  today: z.string(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(8),
  observations: z.array(z.object({ tool: z.string(), args: z.unknown(), result: z.unknown() })).max(6),
});
export type CopilotStepInput = z.infer<typeof copilotStepInput>;

const SYSTEM = `You are the staff copilot for a martial arts school's management system. Answer staff questions about the school's own data.
Rules:
- Get facts by calling one tool per step; never guess names, numbers or dates.
- When you have enough, answer briefly. To quote a value from a tool result, write a placeholder {{obs.N.path}} (N = observation index, path = dotted keys) — the system fills in the real value. Example: "{{obs.0.count}} students".
- Cite every record you relied on in "citations" (kind + id + a short label). For reports use kind "report" and id = the report key.
- You cannot change anything. To contact a family, call propose_action: it only creates a draft for a person to approve; say so in your answer.
- At most 4 tool calls. If the tools can't answer, say what's missing.
Tools: find_person{query}; person_summary{person_id}; attendance_summary{person_id, weeks}; invoices_for_household{household_id}; run_report{key: ${REPORT_KEYS.join("|")}, weeks?}; kb_search{query} (school policies/FAQ); propose_action{person_id, channel, subject?, body, reason}; propose_messages{report: past_due|past_due_absent, channel, subject?, body, reason} (one draft per family in that report; use {{first_name}} for the recipient).`;

export const copilotStep: AiTask<CopilotStepInput, CopilotStep> = {
  id: "copilot_step",
  tier: "frontier",
  description: "Desk copilot: next tool call or the grounded answer",
  input: copilotStepInput,
  output: copilotStepOutput,
  buildMessages: (i) => [
    { role: "system", content: `${SYSTEM}\nSchool: ${i.school}. Today: ${i.today}.` },
    ...i.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: i.question },
    ...(i.observations.length ? [{ role: "user" as const, content: `Tool results so far:\n${i.observations.map((o, n) => `obs.${n} ${o.tool}(${JSON.stringify(o.args)}) → ${JSON.stringify(o.result).slice(0, 6000)}`).join("\n")}\nNext step?` }] : []),
  ],
  maxCostCents: 25,
  temperature: 0.2,
  // Recorded fixtures depend on the question and the tools used so far, not on today's data.
  fixtureKey: (i) => ({ q: i.question.trim().toLowerCase().replace(/\s+/g, " "), tools: i.observations.map((o) => o.tool) }),
  examples: [
    { question: "How many students are past due?", school: "Ridgeline Taekwondo", today: "2026-09-25", history: [], observations: [] },
    { question: "What's our refund policy for testing fees?", school: "Ridgeline Taekwondo", today: "2026-09-25", history: [], observations: [] },
  ],
};

export const homeAssistantInput = z.object({
  question: z.string().trim().min(1).max(1000),
  school: z.string(),
  studentNames: z.array(z.string()).max(10),
  householdFacts: z.string().max(4000),
  kb: z.array(z.object({ id: z.string(), title: z.string(), content: z.string() })).max(8),
});
export type HomeAssistantInput = z.infer<typeof homeAssistantInput>;
export const homeAssistantOutput = z.object({
  answer: z.string().min(1).max(2000),
  /** KB chunk ids the answer relied on. */
  citations: z.array(z.string()).max(8),
  /** True when a person at the front desk should take over. */
  escalate: z.boolean(),
});
export type HomeAssistantOutput = z.infer<typeof homeAssistantOutput>;

export const homeAssistant: AiTask<HomeAssistantInput, HomeAssistantOutput> = {
  id: "home_assistant",
  tier: "fast",
  description: "Home assistant: answers families from the school's policies and their own household only",
  input: homeAssistantInput,
  output: homeAssistantOutput,
  buildMessages: (i) => [
    { role: "system", content: `You help families of ${i.school} in their app. Answer only from the school documents and this family's own information below. You know nothing about other families or students and must never guess or discuss them — say you can't share that and offer to pass the question to the front desk (escalate: true). If the documents don't answer the question, say so and set escalate: true. Be brief and warm. Cite the document ids you used.
This family's students: ${i.studentNames.join(", ") || "none"}.
This family's information:\n${i.householdFacts}
School documents:\n${i.kb.map((k) => `[${k.id}] ${k.title}: ${k.content}`).join("\n---\n")}` },
    { role: "user", content: i.question },
  ],
  maxCostCents: 5,
  temperature: 0.2,
  fixtureKey: (i) => ({ q: i.question.trim().toLowerCase().replace(/\s+/g, " ") }),
  examples: [{ question: "Can I get a refund for a testing fee?", school: "Ridgeline Taekwondo", studentNames: ["Maya"], householdFacts: "", kb: [] }],
};
