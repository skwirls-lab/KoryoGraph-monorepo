"use server";

import { AiError, ping } from "@koryo/ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@koryo/db/types";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney } from "@/lib/curriculum";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

/** Settings → AI → Test connection: the smallest real round trip through the gateway. */
export async function testAiConnection(): Promise<ActionResult<{ fixture: boolean; model: string; echo: string; costCents: number }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage" });
  if (denied) return denied;
  try {
    const r = await aiFor(ctx).runTask(ping, { word: "koryograph" }, { tenantId: ctx.tenantId as string, userId: ctx.userId });
    revalidatePath("/desk/settings/ai");
    return ok({ fixture: r.fixture, model: r.model, echo: r.output.echo, costCents: r.costCents });
  } catch (err) {
    revalidatePath("/desk/settings/ai");
    if (err instanceof AiError) return fail(err.message);
    throw err;
  }
}

export async function setAiBudget(input: { monthly: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage" });
  if (denied) return denied;
  const parsed = z.object({ monthly: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, { error: "Enter an amount like 50.00" }) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter an amount like 50.00");
  const cents = parseMoney(parsed.data.monthly) ?? 0;
  if (cents > 1_000_000) return fail("That's more than $10,000 a month — contact support for a higher limit.");
  const { error } = await ctx.supabase.from("tenant_ai_budgets").upsert({ tenant_id: ctx.tenantId as string, monthly_limit_cents: cents }, { onConflict: "tenant_id" });
  if (error) return fail("Couldn't save the budget.");
  revalidatePath("/desk/settings/ai");
  return ok();
}

const RECOVERY_MODES = ["off", "approve", "auto"] as const;

/** Billing recovery (A8): off = template reminders only; approve = every AI draft waits in Approvals; auto = send once one has been approved. */
export async function setBillingRecoveryMode(input: { mode: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage", module: "intelligence" });
  if (denied) return denied;
  const parsed = z.object({ mode: z.enum(RECOVERY_MODES) }).safeParse(input);
  if (!parsed.success) return fail("Choose off, approve or auto.");
  const { data: t } = await ctx.supabase.from("tenants").select("settings").eq("id", ctx.tenantId as string).single();
  const settings = (t?.settings ?? {}) as Record<string, unknown>;
  const next = { ...settings, ai: { ...((settings.ai ?? {}) as object), billing_recovery: parsed.data.mode } };
  const { error } = await ctx.supabase.from("tenants").update({ settings: next as Json }).eq("id", ctx.tenantId as string);
  if (error) return fail("Couldn't save the setting.");
  revalidatePath("/desk/settings/ai");
  return ok();
}
