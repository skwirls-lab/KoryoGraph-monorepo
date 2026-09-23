import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { packingSlip, type Ai } from "@koryo/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@koryo/db/types";
import { INTAKE_CONFIDENT, type IntakePayload } from "@/lib/intake";

export const INTAKE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

/**
 * A packing slip → stored → read by the vision tier → each line matched to a variant → a doc_intake draft in
 * Approvals, all as the uploading user (RLS). Throws AiError when the slip can't be read.
 */
export async function draftIntake(db: SupabaseClient<Database>, ai: Ai, f: { tenantId: string; userId: string | null; bytes: Buffer; mime: (typeof INTAKE_TYPES)[number]; fileName: string }): Promise<{ approvalId: string } | { error: string }> {
  const path = `${f.tenantId}/intake/${randomUUID()}.${f.mime === "application/pdf" ? "pdf" : f.mime.split("/")[1]}`;
  const { error: upErr } = await db.storage.from("tenant-media").upload(path, f.bytes, { contentType: f.mime });
  if (upErr) return { error: "Couldn't store the file." };
  const r = await ai.runTask(packingSlip, { mime: f.mime, base64: f.bytes.toString("base64"), sha256: createHash("sha256").update(f.bytes).digest("hex"), fileName: f.fileName }, { tenantId: f.tenantId, userId: f.userId });
  const lines = r.output.lines;
  const { data: matches } = await db.rpc("intake_match", { p_texts: lines.map((l) => l.description), p_skus: lines.map((l) => l.skuText ?? "") });
  const byIdx = new Map((matches ?? []).map((m) => [m.idx, m]));
  const { data: suppliers } = await db.from("suppliers").select("id, name");
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
  const { data: item, error } = await db.from("approval_items").insert({
    tenant_id: f.tenantId, kind: "doc_intake", title: `Receive stock${supplierText ? ` from ${supplierText}` : ""}${r.output.reference ? ` · ${r.output.reference}` : ""}`,
    preview: `${lines.length} lines read · ${payload.lines.filter((l) => l.include).length} matched confidently`, payload: payload as unknown as Json, ai_run_id: r.runId, requested_by: f.userId, entity_type: "intake",
  }).select("id").single();
  if (error || !item) return { error: "Couldn't save the draft." };
  return { approvalId: item.id };
}
