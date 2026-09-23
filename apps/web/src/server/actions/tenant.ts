"use server";

import { redirect } from "next/navigation";
import { fail, issuesToFieldErrors, type ActionResult } from "@/lib/action-result";
import { schoolSchema, type SchoolInput } from "@/lib/validation/signup";
import { rememberPlanChoice } from "../lib/plan-choice";
import { getCtx } from "../context";
import { logger } from "../log";

/** F1.3: create a school for the signed-in user (owner role, 14-day trial) and open onboarding. */
export async function createTenantForCurrentUser(input: SchoolInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const parsed = schoolSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));

  const { data: tenantId, error } = await ctx.supabase.rpc("create_tenant", {
    p_name: parsed.data.schoolName,
    p_slug: "",
    p_timezone: parsed.data.timezone,
  });
  if (error || !tenantId) {
    logger(ctx).error({ err: error?.message }, "create_tenant failed");
    return fail("We couldn't create your school. Please try again.");
  }
  // New claims (tenant, owner role, trial modules) arrive with a refreshed token.
  const { error: refreshError } = await ctx.supabase.auth.refreshSession();
  if (refreshError) {
    logger({ ...ctx, tenantId }).error({ err: refreshError.message }, "refresh after create_tenant failed");
    return fail("Your school was created, but your session couldn't refresh. Sign in again to continue.");
  }
  if (parsed.data.plan) await rememberPlanChoice(ctx.supabase, tenantId, parsed.data.plan);
  logger({ ...ctx, tenantId }).info("tenant created via self-serve signup");
  redirect("/desk/onboarding");
}
