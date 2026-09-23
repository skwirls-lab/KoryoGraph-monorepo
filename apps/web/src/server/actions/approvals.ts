"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@koryo/db/types";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { MESSAGE_KINDS, messagePayloadSchema, narrativePayloadSchema, type ApprovalKind } from "@/lib/approvals";
import { techniquePayloadSchema } from "@/lib/technique";
import { executeApproval, type ExecutionResult } from "../approvals/execute";
import { getCtx, type Ctx } from "../context";
import { authorize } from "../lib/authorize";

const need = { permission: "ai.approve" } as const;
/** Approvals serve the Intelligence agents and Vision feedback; either module opens the queue. */
const aiModule = (ctx: Ctx) => (ctx.modules.has("intelligence") || ctx.modules.has("vision") ? null : fail("Approvals need the Intelligence or Vision module."));
const decideSchema = z.object({ id: z.uuid(), decision: z.enum(["approved", "rejected"]), payload: z.unknown().optional(), feedback: z.string().trim().max(1000).optional() });

async function decideOne(ctx: Ctx, v: z.infer<typeof decideSchema>): Promise<ActionResult<{ result: ExecutionResult | null }>> {
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

/** Approve (possibly with an edited payload, then carry it out) or reject with a reason. */
export async function decideApproval(input: z.input<typeof decideSchema>): Promise<ActionResult<{ result: ExecutionResult | null }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need) ?? aiModule(ctx);
  if (denied) return denied;
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid decision");
  const r = await decideOne(ctx, parsed.data);
  revalidatePath("/desk/inbox/approvals");
  revalidatePath("/desk", "layout");
  revalidatePath("/mat/reviews");
  return r;
}

export async function bulkApprove(input: { ids: string[] }): Promise<ActionResult<{ approved: number; failed: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need) ?? aiModule(ctx);
  if (denied) return denied;
  const ids = z.array(z.uuid()).min(1).max(200).safeParse(input.ids);
  if (!ids.success) return fail("Choose items to approve");
  let approved = 0;
  let failed = 0;
  for (const id of ids.data) {
    const r = await decideOne(ctx, { id, decision: "approved" });
    if (r.ok && (!r.data.result || r.data.result.ok)) approved += 1;
    else failed += 1;
  }
  revalidatePath("/desk/inbox/approvals");
  revalidatePath("/desk", "layout");
  return ok({ approved, failed });
}
