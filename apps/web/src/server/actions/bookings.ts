"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const refresh = (sessionId?: string) => {
  revalidatePath("/home/schedule");
  if (sessionId) {
    revalidatePath(`/desk/schedule/sessions/${sessionId}`);
    revalidatePath(`/mat/session/${sessionId}`);
  }
};

/** Book (or waitlist) a person into a class. Staff: anyone; Home: own household (enforced in SQL). */
export async function bookSession(input: { sessionId: string; personId: string; useCredit?: boolean }): Promise<ActionResult<{ status: string; waitlistPosition: number | null }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, {});
  if (denied) return denied;
  const parsed = z.object({ sessionId: z.uuid(), personId: z.uuid(), useCredit: z.boolean().default(false) }).safeParse(input);
  if (!parsed.success) return fail("Invalid booking");
  const { data, error } = await ctx.supabase.rpc("book_session", {
    p_session_id: parsed.data.sessionId, p_person_id: parsed.data.personId, p_use_credit: parsed.data.useCredit,
  });
  if (error) return fail(/can no longer|not open|no makeup/.test(error.message) ? error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." : "Couldn't book that class.");
  const row = data?.[0];
  refresh(parsed.data.sessionId);
  return ok({ status: row?.status ?? "booked", waitlistPosition: row?.waitlist_position ?? null });
}

export async function cancelBooking(input: { bookingId: string; sessionId?: string }): Promise<ActionResult<{ creditEarned: boolean; promoted: boolean }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, {});
  if (denied) return denied;
  if (!z.uuid().safeParse(input.bookingId).success) return fail("Unknown booking");
  const { data, error } = await ctx.supabase.rpc("cancel_booking", { p_booking_id: input.bookingId });
  if (error) return fail(/too late|already/.test(error.message) ? error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." : "Couldn't cancel the booking.");
  const row = data?.[0];
  refresh(input.sessionId);
  return ok({ creditEarned: Boolean(row?.credit_id), promoted: Boolean(row?.promoted_person_id) });
}
