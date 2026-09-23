import "server-only";
import { textToHtml } from "@koryo/comms";
import type { Json } from "@koryo/db/types";
import { messagePayloadSchema, narrativePayloadSchema, type ApprovalKind } from "@/lib/approvals";
import { intakePayloadSchema } from "@/lib/intake";
import { techniquePayloadSchema } from "@/lib/technique";
import { executeBoard } from "../action-board";
import type { Ctx } from "../context";

export interface ApprovedItem { id: string; kind: string; payload: unknown; person_id: string | null }
export type ExecutionResult = { ok: true; summary: string; detail?: Record<string, unknown> } | { ok: false; error: string };
type Executor = (ctx: Ctx, item: ApprovedItem) => Promise<ExecutionResult>;

/**
 * Message kinds: queue the (possibly edited) text to the student's guardians — or the adult themselves —
 * through the Outbox, which applies consent and quiet hours and says plainly when no provider is set up.
 */
const sendMessages: Executor = async (ctx, item) => {
  const parsed = messagePayloadSchema.safeParse(item.payload);
  if (!parsed.success) return { ok: false, error: `Invalid message payload: ${parsed.error.issues[0]?.message ?? "?"}` };
  const { data: recipients, error } = await ctx.supabase.rpc("message_recipients", { p_person_ids: [parsed.data.person_id] });
  if (error) return { ok: false, error: "Couldn't find who to send it to." };
  let queued = 0;
  const seen = new Set<string>();
  for (const r of recipients ?? []) {
    for (const m of parsed.data.messages) {
      const address = m.channel === "email" ? r.email : r.phone;
      if (seen.has(`${r.recipient_person_id}:${m.channel}`)) continue;
      seen.add(`${r.recipient_person_id}:${m.channel}`);
      const body = m.body.replaceAll("{{first_name}}", r.first_name);
      const { error: e } = await ctx.supabase.rpc("record_communication", {
        p: {
          channel: m.channel, person_id: r.recipient_person_id, household_id: r.household_id, to_address: address, template_key: null,
          subject: m.channel === "email" ? (m.subject ?? "A note from your school").replaceAll("{{first_name}}", r.first_name) : null,
          body_text: body, body_html: m.channel === "email" ? textToHtml(body) : null, status: address ? "queued" : "no_address",
          related_type: "approval_item", related_id: item.id,
        } as unknown as Json,
      });
      if (e) return { ok: false, error: e.code === "42501" ? "You need permission to message families (comms.send)." : "Couldn't queue the message." };
      if (address) queued += 1;
    }
  }
  return { ok: true, summary: `${queued} message${queued === 1 ? "" : "s"} queued`, detail: { queued } };
};

const EXECUTORS: Partial<Record<ApprovalKind, Executor>> = {
  drift_outreach: sendMessages,
  billing_recovery: sendMessages,
  copilot_write: sendMessages,
  action_board: (ctx, item) => executeBoard(ctx.supabase, item.id, item.payload),
  parent_narrative: async (ctx, item) => {
    const p = narrativePayloadSchema.safeParse(item.payload);
    if (!p.success) return { ok: false, error: "The update changed shape; open it again." };
    const { error } = await ctx.supabase.from("home_updates").upsert({ tenant_id: ctx.tenantId as string, person_id: p.data.person_id, week_of: p.data.week_of, body: p.data.body, approval_item_id: item.id, published_at: new Date().toISOString() }, { onConflict: "person_id,week_of" });
    if (error) return { ok: false, error: error.code === "42501" ? "Publishing needs the ai.approve permission." : "Couldn't publish the update." };
    return { ok: true, summary: "Published on Home" };
  },
  vision_feedback: async (ctx, item) => {
    if (!techniquePayloadSchema.safeParse(item.payload).success) return { ok: false, error: "The feedback changed shape; open it again." };
    const { data, error } = await ctx.supabase.rpc("release_technique_feedback", { p_id: item.id });
    if (error) return { ok: false, error: error.code === "42501" ? "Releasing feedback needs the ai.approve permission." : error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." };
    const r = data as { summary: string };
    return { ok: true, summary: r.summary };
  },
  doc_intake: async (ctx, item) => {
    if (!intakePayloadSchema.safeParse(item.payload).success) return { ok: false, error: "The intake changed shape; open it again." };
    const { data, error } = await ctx.supabase.rpc("receive_intake", { p_id: item.id });
    if (error) return { ok: false, error: error.code === "42501" ? "Receiving stock needs inventory and approval permissions." : error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." };
    const r = data as { summary: string; detail: Record<string, unknown> };
    return { ok: true, summary: r.summary, detail: r.detail };
  },
};

export function registerExecutor(kind: ApprovalKind, fn: Executor): void {
  EXECUTORS[kind] = fn;
}

export async function executeApproval(ctx: Ctx, item: ApprovedItem): Promise<ExecutionResult> {
  const fn = EXECUTORS[item.kind as ApprovalKind];
  if (!fn) return { ok: false, error: `Nothing knows how to carry out a "${item.kind}" item yet.` };
  try {
    return await fn(ctx, item);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
