"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

export async function completeTask(input: { taskId: string; done: boolean }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  if (!z.uuid().safeParse(input.taskId).success) return fail("Invalid task.");
  const { error } = await ctx.supabase.from("tasks").update(input.done ? { done_at: new Date().toISOString(), done_by: ctx.userId } : { done_at: null, done_by: null }).eq("id", input.taskId);
  if (error) return fail("Couldn't update the task.");
  revalidatePath("/desk");
  return ok();
}
