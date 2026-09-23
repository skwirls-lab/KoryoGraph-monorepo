"use server";

import { AiError } from "@koryo/ai";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { draftIntake, INTAKE_TYPES } from "../intake";
import { authorize } from "../lib/authorize";

/** Upload a packing slip → vision reads the lines → each line matched to a variant → draft in Approvals. */
export async function uploadPackingSlip(form: FormData): Promise<ActionResult<{ approvalId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "inventory.manage", module: "retail" });
  if (denied) return denied;
  if (!ctx.modules.has("intelligence")) return fail("Reading packing slips is part of the Intelligence module. Adjust stock by hand in Inventory.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 100) return fail("Choose a packing slip (photo or PDF).");
  const mime = INTAKE_TYPES.find((t) => t === file.type);
  if (!mime) return fail("Use a PNG, JPEG, WebP or PDF.");
  if (file.size > 8 * 1024 * 1024) return fail("Files can be up to 8 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const r = await draftIntake(ctx.supabase, aiFor(ctx), { tenantId: ctx.tenantId as string, userId: ctx.userId, bytes, mime, fileName: file.name });
    if ("error" in r) return fail(r.error);
    revalidatePath("/desk/retail/receive");
    return ok({ approvalId: r.approvalId });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return fail(err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model" ? "AI isn't configured on this server (no OpenRouter key), so the slip can't be read. Receive stock by hand in Inventory." : err.message);
  }
}
