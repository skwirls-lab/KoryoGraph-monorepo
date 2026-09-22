"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isTheme, type Theme } from "@koryo/ui/components/theme/themes";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { logger } from "../log";

/** Switch the active tenant for a multi-school user, then refresh the JWT so claims follow. */
export async function switchTenant(tenantId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const id = z.uuid().safeParse(tenantId);
  if (!id.success) return fail("Unknown school");
  const { error } = await ctx.supabase.rpc("switch_tenant", { p_tenant_id: id.data });
  if (error) return fail("You're not a member of that school.");
  const { error: refreshError } = await ctx.supabase.auth.refreshSession();
  if (refreshError) {
    logger(ctx).error({ err: refreshError.message }, "session refresh after tenant switch failed");
    return fail("Switched, but your session couldn't refresh. Sign in again.");
  }
  redirect("/auth/landing");
}

/** Persist the theme choice on the profile (the kg-theme cookie is set client-side). */
export async function saveThemePreference(theme: Theme): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!isTheme(theme)) return fail("Unknown theme");
  const { error } = await ctx.supabase.from("profiles").update({ preferred_theme: theme }).eq("id", ctx.userId);
  if (error) return fail("Couldn't save your theme");
  return ok();
}
