"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

export async function assignLessonPlan(input: { sessionId: string; lessonPlanId: string | null }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "attendance.write" });
  if (denied) return denied;
  const parsed = z.object({ sessionId: z.uuid(), lessonPlanId: z.uuid().nullable() }).safeParse(input);
  if (!parsed.success) return fail("Invalid lesson plan");
  const { error } = await ctx.supabase.from("class_sessions").update({ lesson_plan_id: parsed.data.lessonPlanId }).eq("id", parsed.data.sessionId);
  if (error) return fail("Couldn't attach the lesson plan.");
  revalidatePath(`/mat/session/${parsed.data.sessionId}`);
  return ok();
}
