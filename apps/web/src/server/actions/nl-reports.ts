"use server";

import { AiError, chartSpec, nlReport, validateReportSql, type ChartSpec } from "@koryo/ai";
import type { Json } from "@koryo/db/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { todayIn } from "@/lib/people";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";
import { runReportSql } from "../nl-reports";

const need = { permission: "reports.read" } as const;
export interface NlResult { title: string; sql: string; chart: ChartSpec; explanation: string; rows: Record<string, unknown>[]; fixture: boolean; runId: string | null }

export async function askReport(input: { question: string }): Promise<ActionResult<NlResult>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { ...need, module: "intelligence" });
  if (denied) return denied;
  const q = z.string().trim().min(3, { error: "Ask a question" }).max(500).safeParse(input.question);
  if (!q.success) return fail(q.error.issues[0]?.message ?? "Ask a question");
  try {
    const r = await aiFor(ctx).runTask(nlReport, { question: q.data, today: todayIn(ctx.tz), school: ctx.tenantName ?? "the school" }, { tenantId: ctx.tenantId as string, userId: ctx.userId });
    const run = await runReportSql(ctx, r.output.sql);
    if (!run.ok) return fail(`The drafted query was refused: ${run.error}`);
    return ok({ title: r.output.title, sql: run.sql, chart: r.output.chart, explanation: r.output.explanation, rows: run.rows, fixture: r.fixture, runId: r.runId });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return fail(err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model" ? "There's no OpenRouter key on this server and that question isn't a recorded dev example. The report library has the standard reports." : err.message);
  }
}

const saveSchema = z.object({ name: z.string().trim().min(2, { error: "Name the report" }).max(120), question: z.string().max(500), sql: z.string().max(5000), chart: chartSpec, runId: z.uuid().nullable() });

export async function saveReport(input: z.input<typeof saveSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const v = saveSchema.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Check the report");
  if (!validateReportSql(v.data.sql).ok) return fail("That query can't be saved.");
  const { data, error } = await ctx.supabase.from("saved_reports").insert({ tenant_id: ctx.tenantId as string, name: v.data.name, question: v.data.question, sql: v.data.sql, chart: v.data.chart as unknown as Json, ai_run_id: v.data.runId, created_by: ctx.userId }).select("id").single();
  if (error || !data) return fail("Couldn't save the report.");
  revalidatePath("/desk/reports");
  redirect(`/desk/reports/saved/${data.id}`);
}

export async function deleteSavedReport(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const { error } = await ctx.supabase.from("saved_reports").delete().eq("id", input.id);
  if (error) return fail("Couldn't delete it.");
  revalidatePath("/desk/reports");
  redirect("/desk/reports");
}
