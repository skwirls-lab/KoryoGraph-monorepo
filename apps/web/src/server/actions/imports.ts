"use server";

import { randomUUID } from "node:crypto";
import { AiError, importMapping } from "@koryo/ai";
import type { Json } from "@koryo/db/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { autoMap, detectPreset, IMPORT_FIELDS, PRESETS, type Mapping } from "@/lib/import/fields";
import { normalizeRows, type RowIssue } from "@/lib/import/normalize";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { columnShape, importLookups, loadImportFile, parseCsv } from "../imports";
import { authorize } from "../lib/authorize";

const need = { permission: "people.write" } as const;
const CHUNK = 50;
const FIELD_KEYS = IMPORT_FIELDS.map((f) => f.key) as [string, ...string[]];
const mappingSchema = z.record(z.string().max(120), z.enum(FIELD_KEYS).nullable());

/** Step 1: upload a CSV (≤ 5 MB); columns are detected and mapped from the best-matching preset. */
export async function uploadImport(form: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 10) return fail("Choose a CSV file.");
  if (file.size > 5 * 1024 * 1024) return fail("Files can be up to 5 MB (about 20,000 rows).");
  if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") return fail("Save the spreadsheet as CSV first (File → Save as → CSV).");
  const text = await file.text();
  const { headers, records } = parseCsv(text);
  if (headers.length < 2 || !records.length) return fail("That file has no header row or no data rows.");
  if (records.length > 20_000) return fail("That's more than 20,000 rows; split the file.");
  const preset = detectPreset(headers);
  const path = `${ctx.tenantId}/imports/${randomUUID()}.csv`;
  const { error: upErr } = await ctx.supabase.storage.from("tenant-media").upload(path, new Blob([text], { type: "text/csv" }), { contentType: "text/csv" });
  if (upErr) return fail("Couldn't store the file.");
  const { data, error } = await ctx.supabase.from("imports").insert({
    tenant_id: ctx.tenantId as string, file_name: file.name.slice(0, 200), storage_path: path, preset, headers, row_count: records.length,
    mapping: autoMap(headers, preset) as unknown as Json, created_by: ctx.userId,
  }).select("id").single();
  if (error || !data) return fail("Couldn't start the import.");
  revalidatePath("/desk/people/import");
  return ok({ id: data.id });
}

/** Step 2: the school's column mapping (and preset). */
export async function saveImportMapping(input: { id: string; mapping: Mapping; preset?: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.object({ id: z.uuid(), mapping: mappingSchema, preset: z.string().optional() }).safeParse(input);
  if (!v.success) return fail("Invalid mapping.");
  const used = Object.values(v.data.mapping).filter(Boolean);
  if (new Set(used).size !== used.length) return fail("Each field can only come from one column.");
  if (!used.includes("first_name")) return fail("Choose the column with first names.");
  const preset = v.data.preset && (v.data.preset === "generic" || v.data.preset in PRESETS) ? v.data.preset : undefined;
  const { error } = await ctx.supabase.from("imports").update({ mapping: v.data.mapping as unknown as Json, ...(preset ? { preset } : {}) }).eq("id", v.data.id).eq("status", "uploaded");
  if (error) return fail("Couldn't save the mapping.");
  revalidatePath(`/desk/people/import/${v.data.id}`);
  return ok();
}

/** A6 assist: suggest a mapping from column names and value shapes (the data itself isn't sent). */
export async function suggestImportMapping(input: { id: string }): Promise<ActionResult<{ mapping: Mapping; fixture: boolean }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { ...need, module: "intelligence" });
  if (denied) return denied;
  const f = await loadImportFile(ctx, input.id);
  if (!f) return fail("Import not found.");
  const columns = f.parsed.headers.map((h) => ({ header: h, ...columnShape(f.parsed.records.slice(0, 200).map((r) => r[h] ?? "")) }));
  try {
    const r = await aiFor(ctx).runTask(importMapping, { columns, fields: IMPORT_FIELDS.map((x) => ({ key: x.key, label: x.label })) }, { tenantId: ctx.tenantId as string, userId: ctx.userId });
    const mapping: Mapping = {};
    const used = new Set<string>();
    for (const h of f.parsed.headers) {
      const m = r.output.mapping.find((x) => x.header === h);
      const field = m?.field && (FIELD_KEYS as string[]).includes(m.field) && !used.has(m.field) && m.confidence >= 0.5 ? m.field : null;
      if (field) used.add(field);
      mapping[h] = field as Mapping[string];
    }
    return ok({ mapping, fixture: r.fixture });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return fail(err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model" ? "AI suggestions aren't available on this server (no OpenRouter key). Map the columns by hand." : err.message);
  }
}

export interface ValidationReport { total: number; valid: number; toCreate: number; toUpdate: number; errors: RowIssue[]; warnings: RowIssue[] }

/** Step 3 (dry run): what would happen, without changing anything. */
export async function validateImport(input: { id: string }): Promise<ActionResult<ValidationReport>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const f = await loadImportFile(ctx, input.id);
  if (!f) return fail("Import not found.");
  const { rows, errors, warnings } = normalizeRows(f.parsed.records, f.imp.mapping as Mapping, await importLookups(ctx));
  const ids = rows.map((r) => r.external_id).filter((x): x is string => Boolean(x));
  let existing = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const { count } = await ctx.supabase.from("people").select("id", { count: "exact", head: true }).in("external_id", ids.slice(i, i + 500));
    existing += count ?? 0;
  }
  return ok({ total: f.parsed.records.length, valid: rows.length, toCreate: rows.length - existing, toUpdate: existing, errors: errors.slice(0, 500), warnings: warnings.slice(0, 500) });
}

/** Step 4: commit one chunk of valid rows (the page calls this until done, showing progress). */
export async function commitImportChunk(input: { id: string; offset: number }): Promise<ActionResult<{ next: number | null; total: number; stats: Record<string, number> }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.object({ id: z.uuid(), offset: z.number().int().min(0) }).safeParse(input);
  if (!v.success) return fail("Invalid request.");
  const f = await loadImportFile(ctx, v.data.id);
  if (!f) return fail("Import not found.");
  const { rows } = normalizeRows(f.parsed.records, f.imp.mapping as Mapping, await importLookups(ctx));
  const chunk = rows.slice(v.data.offset, v.data.offset + CHUNK);
  const { data, error } = await ctx.supabase.rpc("import_rows", { p_import_id: v.data.id, p_rows: chunk as unknown as Json });
  if (error) {
    await ctx.supabase.from("imports").update({ status: "failed", error: error.message.slice(0, 500) }).eq("id", v.data.id);
    return fail(`Rows ${chunk[0]?.row ?? "?"}–${chunk.at(-1)?.row ?? "?"} couldn't be imported: ${error.message}. Rows before them were imported; you can roll back.`);
  }
  const next = v.data.offset + CHUNK < rows.length ? v.data.offset + CHUNK : null;
  return ok({ next, total: rows.length, stats: data as Record<string, number> });
}

export async function finishImport(input: { id: string; stats: Record<string, number> }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.object({ id: z.uuid(), stats: z.record(z.string(), z.number().int().min(0)) }).safeParse(input);
  if (!v.success) return fail("Invalid request.");
  const { error } = await ctx.supabase.rpc("finish_import", { p_import_id: v.data.id, p_stats: v.data.stats as unknown as Json });
  if (error) return fail("Couldn't finish the import.");
  revalidatePath("/desk/people");
  revalidatePath("/desk/people/import");
  return ok();
}

/** Undo: delete everything the import created (people it only updated keep the update). */
export async function rollbackImport(input: { id: string }): Promise<ActionResult<{ people: number; households: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = z.uuid().safeParse(input.id);
  if (!v.success) return fail("Invalid import.");
  const { data, error } = await ctx.supabase.rpc("rollback_import", { p_import_id: v.data });
  if (error) return fail(error.code === "23503" ? "Some imported people now have invoices or other records that can't be deleted; remove those first." : "Couldn't roll back the import.");
  revalidatePath("/desk/people");
  revalidatePath("/desk/people/import");
  return ok(data as { people: number; households: number });
}
