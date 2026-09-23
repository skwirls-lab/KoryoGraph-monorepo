"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

/** Mark a schedule suggestion done or dismissed (it stays for the record; the card shows open ones). */
export async function setSuggestionStatus(input: { id: string; status: "done" | "dismissed" }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "schedule.manage", module: "intelligence" });
  if (denied) return denied;
  const v = z.object({ id: z.uuid(), status: z.enum(["done", "dismissed"]) }).safeParse(input);
  if (!v.success) return fail("Invalid suggestion.");
  const { data, error } = await ctx.supabase.from("schedule_suggestions").update({ status: v.data.status }).eq("id", v.data.id).select("id");
  if (error || !data?.length) return fail("Couldn't update the suggestion.");
  revalidatePath("/desk");
  return ok();
}
