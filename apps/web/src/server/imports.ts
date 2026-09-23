import "server-only";
import Papa from "papaparse";
import { todayIn } from "@/lib/people";
import type { Lookups } from "@/lib/import/normalize";
import type { Ctx } from "./context";

export interface Parsed { headers: string[]; records: Record<string, string>[] }

export function parseCsv(text: string): Parsed {
  const r = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = (r.meta.fields ?? []).filter((h) => h !== "");
  return { headers, records: r.data };
}

/** What kind of values a column holds (sent to the mapping assist instead of the values themselves). */
export function columnShape(values: string[]): { shape: "empty" | "email" | "date" | "phone" | "number" | "yes_no" | "text"; filled: number } {
  const v = values.map((x) => (x ?? "").trim()).filter(Boolean);
  const filled = values.length ? v.length / values.length : 0;
  if (!v.length) return { shape: "empty", filled };
  const share = (re: RegExp) => v.filter((x) => re.test(x)).length / v.length;
  if (share(/^[^@\s]+@[^@\s]+\.[^@\s]+$/) > 0.8) return { shape: "email", filled };
  if (share(/^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4})$/) > 0.8) return { shape: "date", filled };
  if (share(/^(yes|no|y|n|true|false|0|1)$/i) > 0.8) return { shape: "yes_no", filled };
  if (share(/^-?\d+(\.\d+)?$/) > 0.8) return { shape: "number", filled };
  if (share(/^[+()\d\s.-]{7,}$/) > 0.8) return { shape: "phone", filled };
  return { shape: "text", filled };
}

export async function loadImportFile(ctx: Ctx, id: string): Promise<{ imp: { id: string; status: string; mapping: Record<string, string | null>; preset: string; file_name: string }; parsed: Parsed } | null> {
  const { data: imp } = await ctx.supabase.from("imports").select("id, status, mapping, preset, file_name, storage_path").eq("id", id).maybeSingle();
  if (!imp) return null;
  const { data: file } = await ctx.supabase.storage.from("tenant-media").download(imp.storage_path);
  if (!file) return null;
  return { imp: { ...imp, mapping: (imp.mapping ?? {}) as Record<string, string | null> }, parsed: parseCsv(await file.text()) };
}

export async function importLookups(ctx: Ctx): Promise<Lookups> {
  const [{ data: programs }, { data: plans }] = await Promise.all([
    ctx.supabase.from("programs").select("id, name, ranks(id, name, position)").eq("active", true),
    ctx.supabase.from("membership_plans").select("id, name").eq("active", true),
  ]);
  return {
    today: todayIn(ctx.tz),
    programs: (programs ?? []).map((p) => ({ id: p.id, name: p.name, ranks: (p.ranks ?? []).sort((a, b) => a.position - b.position).map((r) => ({ id: r.id, name: r.name })) })),
    plans: plans ?? [],
  };
}
