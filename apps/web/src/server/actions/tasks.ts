"use server";

import { zonedWallTimeToUtc } from "@koryo/scheduling";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { taskSchema, type TaskInput } from "@/lib/validation/staff";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

/** Staff with people.write complete any task; anyone completes tasks assigned to them (RLS decides). */
export async function completeTask(input: { taskId: string; done: boolean }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.read" });
  if (denied) return denied;
  if (!z.uuid().safeParse(input.taskId).success) return fail("Invalid task.");
  const { data, error } = await ctx.supabase.from("tasks").update(input.done ? { done_at: new Date().toISOString(), done_by: ctx.userId } : { done_at: null, done_by: null }).eq("id", input.taskId).select("id");
  if (error || !data?.length) return fail("Couldn't update the task.");
  revalidatePath("/desk");
  revalidatePath("/desk/tasks");
  return ok();
}

export async function createTask(input: TaskInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const due = v.dueDate ? (() => { const [y, m, d] = v.dueDate.split("-").map(Number) as [number, number, number]; return zonedWallTimeToUtc({ year: y, month: m, day: d, hour: 17, minute: 0 }, ctx.tz).toISOString(); })() : null;
  const { error } = await ctx.supabase.from("tasks").insert({
    tenant_id: ctx.tenantId as string, title: v.title, body: v.body || null, assignee_user_id: v.assigneeUserId || null, due_at: due, person_id: v.personId || null, source: "manual", created_by: ctx.userId,
  });
  if (error) return fail("Couldn't create the task.");
  revalidatePath("/desk/tasks");
  revalidatePath("/desk");
  return ok();
}

export async function assignTask(input: { taskId: string; assigneeUserId: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = z.object({ taskId: z.uuid(), assigneeUserId: z.uuid().or(z.literal("")) }).safeParse(input);
  if (!parsed.success) return fail("Invalid assignment");
  const { error } = await ctx.supabase.from("tasks").update({ assignee_user_id: parsed.data.assigneeUserId || null }).eq("id", parsed.data.taskId);
  if (error) return fail("Couldn't assign the task.");
  revalidatePath("/desk/tasks");
  return ok();
}
