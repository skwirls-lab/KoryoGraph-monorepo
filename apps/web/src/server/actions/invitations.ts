"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";

/** Accept a staff invitation (the signed-in user's own), switch to that school and open it. */
export async function acceptInvitation(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const v = z.uuid().safeParse(input.id);
  if (!v.success) return fail("Invalid invitation.");
  const { error } = await ctx.supabase.rpc("accept_invitation", { p_tenant_user_id: v.data });
  if (error) return fail("That invitation is no longer open.");
  await ctx.supabase.auth.refreshSession();
  redirect("/auth/landing");
}
