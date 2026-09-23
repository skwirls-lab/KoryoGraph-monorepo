import "server-only";
import { z } from "zod";
import type { Json } from "@koryo/db/types";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { MESSAGE_KINDS, messagePayloadSchema, narrativePayloadSchema, type ApprovalKind } from "@/lib/approvals";
import { techniquePayloadSchema } from "@/lib/technique";
import { executeApproval, type ExecCtx, type ExecutionResult } from "./execute";

export const decideSchema = z.object({ id: z.uuid(), decision: z.enum(["approved", "rejected"]), payload: z.unknown().optional(), feedback: z.string().trim().max(1000).optional() });

/**
 * Record a decision (optionally with the reviewer's edited payload, validated per kind) and, on approval, carry
 * it out as the approver. Shared by the Approvals UI and the demo seed.
 */
export async function decideOne(ctx: ExecCtx, v: z.infer<typeof decideSchema>): Promise<ActionResult<{ result: ExecutionResult | null }>> {
  const { data: current } = await ctx.supabase.from("approval_items").select("kind").eq("id", v.id).maybeSingle();
  if (!current) return fail("Item not found.");
  if (v.payload !== undefined && MESSAGE_KINDS.includes(current.kind as ApprovalKind)) {
    const p = messagePayloadSchema.safeParse(v.payload);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the message");
  }
  if (v.payload !== undefined && current.kind === "vision_feedback") {
    const p = techniquePayloadSchema.safeParse(v.payload);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the feedback");
  }
  if (v.payload !== undefined && current.kind === "parent_narrative") {
    const p = narrativePayloadSchema.safeParse(v.payload);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the update");
  }
  const { data: item, error } = await ctx.supabase.rpc("decide_approval", {
    p_id: v.id, p_decision: v.decision, p_payload: (v.payload ?? null) as Json, p_feedback: v.feedback ?? undefined,
  });
  if (error || !item) return fail(error?.code === "42501" ? "You don't have permission to approve." : error?.message ? error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." : "Couldn't record the decision.");
  if (v.decision === "rejected") return ok({ result: null });
  const result = await executeApproval(ctx, item);
  if (!["action_board", "doc_intake", "vision_feedback"].includes(item.kind) || !result.ok) await ctx.supabase.rpc("record_approval_execution", { p_id: item.id, p_result: result as unknown as Json });
  return ok({ result });
}

