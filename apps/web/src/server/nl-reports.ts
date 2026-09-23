import "server-only";
import { validateReportSql } from "@koryo/ai";
import type { Ctx } from "./context";

/** Validate (again) and run as nl_reader. */
export async function runReportSql(ctx: Ctx, raw: string): Promise<{ ok: true; rows: Record<string, unknown>[]; sql: string } | { ok: false; error: string }> {
  const check = validateReportSql(raw);
  if (!check.ok) return check;
  const { data, error } = await ctx.supabase.rpc("run_nl_report", { p_sql: check.sql });
  if (error) return { ok: false, error: error.message.includes("timeout") ? "That report took too long to run." : `The query didn't run: ${error.message}` };
  return { ok: true, rows: (data ?? []) as Record<string, unknown>[], sql: check.sql };
}

