import { z } from "zod";

/** Automation definitions (F10.5). Shared by the editor, the server actions and the automations job. */
export const TRIGGER_KINDS = {
  "membership.created": "A membership starts",
  "lead.stage_changed": "A lead reaches a pipeline stage",
  "testing.invited": "A student is invited to a belt test",
  "payment.failed": "A payment fails",
  "promotion.created": "A student is promoted",
  absence: "A student hasn't trained for N days",
  birthday: "It's a student's birthday",
  membership_expiring: "A membership ends within N days",
  contract_ending: "A contract ends within N days",
} as const;
export type TriggerKind = keyof typeof TRIGGER_KINDS;
export const SCHEDULED: readonly TriggerKind[] = ["absence", "birthday", "membership_expiring", "contract_ending"];

export const triggerSchema = z.object({
  kind: z.enum(Object.keys(TRIGGER_KINDS) as [TriggerKind, ...TriggerKind[]]),
  params: z.object({ days: z.number().int().min(1).max(365).optional(), stage: z.string().max(40).optional() }).default({}),
});

export const conditionSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("status"), op: z.literal("in"), value: z.array(z.string()).min(1) }),
  z.object({ field: z.literal("program"), op: z.literal("in"), value: z.array(z.uuid()).min(1) }),
  z.object({ field: z.literal("tag"), op: z.enum(["has", "not_has"]), value: z.string().min(1).max(40) }),
  z.object({ field: z.literal("consent"), op: z.literal("has"), value: z.enum(["email", "sms"]) }),
]);
export type Condition = z.infer<typeof conditionSchema>;

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("send"), template_key: z.string().min(1).max(60), channels: z.array(z.enum(["email", "sms"])).min(1), only_if: z.literal("registration_pending").optional() }),
  z.object({ type: z.literal("wait"), days: z.number().int().min(1).max(365) }),
  z.object({ type: z.literal("create_task"), title: z.string().trim().min(2).max(200), due_days: z.number().int().min(0).max(365).default(1) }),
  z.object({ type: z.literal("notify_staff"), title: z.string().trim().min(2).max(200) }),
  z.object({ type: z.literal("add_tag"), tag: z.string().trim().min(1).max(40) }),
]);
export type AutomationAction = z.infer<typeof actionSchema>;

export const automationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, { error: "Name the automation" }).max(120),
  description: z.string().trim().max(500).default(""),
  trigger: triggerSchema,
  conditions: z.array(conditionSchema).max(10).default([]),
  actions: z.array(actionSchema).min(1, { error: "Add at least one action" }).max(20),
  active: z.boolean().default(false),
});
export type AutomationInput = z.input<typeof automationSchema>;

export const ACTION_LABELS: Record<AutomationAction["type"], string> = {
  send: "Send a message", wait: "Wait", create_task: "Create a task", notify_staff: "Notify staff", add_tag: "Add a tag",
};

/** {{student_name}} etc. in task titles. */
export function renderTitle(title: string, data: Record<string, string | number | null | undefined>): string {
  return title.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => String(data[k] ?? ""));
}
