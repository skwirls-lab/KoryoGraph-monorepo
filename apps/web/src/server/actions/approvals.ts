"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { decideOne, decideSchema } from "../approvals/decide";
import type { ExecutionResult } from "../approvals/execute";
import { getCtx, type Ctx } from "../context";
import { authorize } from "../lib/authorize";

const need = { permission: "ai.approve" } as const;
/** Approvals serve the Intelligence agents and Vision feedback; either module opens the queue. */
const aiModule = (ctx: Ctx) => (ctx.modules.has("intelligence") || ctx.modules.has("vision") ? null : fail("Approvals need the Intelligence or Vision module."));
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
