"use server";

import { DbError, rpc } from "@koryo/db";
import { createAnonClient } from "@koryo/db/anon";
import type { Json } from "@koryo/db/types";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { trialRequestSchema, type TrialRequestInput } from "@/lib/validation/crm";

/**
 * Public trial form (no login). Runs as anon through submit_trial_request, which creates or merges the lead
 * (duplicate email/phone), optionally books the chosen class, and never reveals whether someone exists.
 */
export async function submitTrialRequest(slug: string, input: TrialRequestInput): Promise<ActionResult<{ booked: boolean }>> {
  const parsed = trialRequestSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (!/^[a-z0-9-]{1,50}$/.test(slug)) return fail("Unknown school.");
  try {
    const r = (await rpc(createAnonClient(), "submit_trial_request", {
      p_slug: slug,
      p: { first_name: v.firstName, last_name: v.lastName, email: v.email, phone: v.phone, program_id: v.programId, session_id: v.sessionId, message: v.message, website: v.website, source: v.utm.utm_source ? "campaign" : "website", utm: v.utm } as unknown as Json,
    })) as { booked?: boolean };
    return ok({ booked: Boolean(r.booked) });
  } catch (err) {
    return fail(err instanceof DbError && err.code === "22023" ? err.message.charAt(0).toUpperCase() + err.message.slice(1) + "." : "We couldn't send that. Please call the school.");
  }
}
