"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const sources = ["mat", "desk", "kiosk", "home", "action_board", "import"] as const;
const input = z.object({ sessionId: z.uuid(), personId: z.uuid(), present: z.boolean(), source: z.enum(sources).default("desk") });

/**
 * Check a person in (or out) of a session. Idempotent: checking in twice keeps the first check-in;
 * unchecking an absent person is a no-op. Server state wins on conflicts (offline replay).
 */
export async function setAttendance(raw: z.input<typeof input>): Promise<ActionResult<{ present: boolean }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "attendance.write" });
  if (denied) return denied;
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail("Invalid check-in");
  const v = parsed.data;
  if (v.present) {
    const { error } = await ctx.supabase.from("attendance").upsert(
      { tenant_id: ctx.tenantId as string, session_id: v.sessionId, person_id: v.personId, source: v.source, checked_in_by_user_id: ctx.userId },
      { onConflict: "session_id,person_id", ignoreDuplicates: true },
    );
    if (error) return fail("Couldn't check in.");
    await ctx.supabase.from("bookings").update({ status: "attended" }).eq("session_id", v.sessionId).eq("person_id", v.personId).eq("status", "booked");
  } else {
    const { error } = await ctx.supabase.from("attendance").delete().eq("session_id", v.sessionId).eq("person_id", v.personId);
    if (error) return fail("Couldn't undo the check-in.");
    await ctx.supabase.from("bookings").update({ status: "booked" }).eq("session_id", v.sessionId).eq("person_id", v.personId).eq("status", "attended");
  }
  revalidatePath(`/desk/schedule/sessions/${v.sessionId}`);
  revalidatePath(`/mat/session/${v.sessionId}`);
  return ok({ present: v.present });
}
