"use server";

import { createHash, randomUUID } from "node:crypto";
import { AiError, packingSlip } from "@koryo/ai";
import type { Json } from "@koryo/db/types";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { INTAKE_CONFIDENT, type IntakePayload } from "@/lib/intake";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

/** Upload a packing slip → vision reads the lines → each line matched to a variant → draft in Approvals. */
export async function uploadPackingSlip(form: FormData): Promise<ActionResult<{ approvalId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "inventory.manage", module: "retail" });
  if (denied) return denied;
  if (!ctx.modules.has("intelligence")) return fail("Reading packing slips is part of the Intelligence module. Adjust stock by hand in Inventory.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 100) return fail("Choose a packing slip (photo or PDF).");
  const mime = TYPES.find((t) => t === file.type);
  if (!mime) return fail("Use a PNG, JPEG, WebP or PDF.");
  if (file.size > 8 * 1024 * 1024) return fail("Files can be up to 8 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${ctx.tenantId}/intake/${randomUUID()}.${mime === "application/pdf" ? "pdf" : mime.split("/")[1]}`;
  const { error: upErr } = await ctx.supabase.storage.from("tenant-media").upload(path, bytes, { contentType: mime });
  if (upErr) return fail("Couldn't store the file.");
  let r;
  try {
    r = await aiFor(ctx).runTask(packingSlip, { mime, base64: bytes.toString("base64"), sha256: createHash("sha256").update(bytes).digest("hex"), fileName: file.name }, { tenantId: ctx.tenantId as string, userId: ctx.userId });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return fail(err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model" ? "AI isn't configured on this server (no OpenRouter key), so the slip can't be read. Receive stock by hand in Inventory." : err.message);
  }
  const lines = r.output.lines;
  const { data: matches } = await ctx.supabase.rpc("intake_match", { p_texts: lines.map((l) => l.description), p_skus: lines.map((l) => l.skuText ?? "") });
  const byIdx = new Map((matches ?? []).map((m) => [m.idx, m]));
  const { data: suppliers } = await ctx.supabase.from("suppliers").select("id, name");
  const supplierText = r.output.supplier?.trim() ?? null;
  const supplier = supplierText ? (suppliers ?? []).find((s) => s.name.toLowerCase().includes(supplierText.toLowerCase()) || supplierText.toLowerCase().includes(s.name.toLowerCase())) : undefined;
  const payload: IntakePayload = {
    file_path: path, supplier_id: supplier?.id ?? null, supplier_text: supplierText, reference: r.output.reference, location_id: null,
    lines: lines.map((l, i) => {
      const m = byIdx.get(i + 1);
      const conf = m ? Number(m.confidence) : 0;
      const matched = m && conf >= 0.3;
      return { description: l.description, sku_text: l.skuText, quantity: l.quantity, unit_cost_cents: l.unitCostCents, variant_id: matched ? m.variant_id : null, variant_label: matched ? `${m.label} (${m.sku})` : null, confidence: matched ? conf : 0, include: Boolean(matched) && conf >= INTAKE_CONFIDENT && l.quantity > 0 };
    }),
  };
  const { data: item, error } = await ctx.supabase.from("approval_items").insert({
    tenant_id: ctx.tenantId as string, kind: "doc_intake", title: `Receive stock${supplierText ? ` from ${supplierText}` : ""}${r.output.reference ? ` · ${r.output.reference}` : ""}`,
    preview: `${lines.length} lines read · ${payload.lines.filter((l) => l.include).length} matched confidently`, payload: payload as unknown as Json, ai_run_id: r.runId, requested_by: ctx.userId, entity_type: "intake",
  }).select("id").single();
  if (error || !item) return fail("Couldn't save the draft.");
  revalidatePath("/desk/retail/receive");
  return ok({ approvalId: item.id });
}
