"use server";

import { headers } from "next/headers";
import { createAnonClient } from "@koryo/db/anon";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { guestWaiverSchema, type GuestWaiverInput } from "@/lib/validation/events";

// Party guest waivers: no session; the link token is validated by sign_guest_waiver() in the database.
export async function signGuestWaiver(input: GuestWaiverInput): Promise<ActionResult> {
  const parsed = guestWaiverSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const h = await headers();
  const { error } = await createAnonClient().rpc("sign_guest_waiver", {
    p_token: v.token, p_guest_name: v.guestName, p_guardian_name: v.guardianName,
    p_guardian_phone: v.guardianPhone, p_typed_signature: v.typedSignature, p_ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
    ...(v.guestDob ? { p_guest_dob: v.guestDob } : {}),
  });
  if (error) return fail(/no longer valid/.test(error.message) ? "This link is no longer valid. Ask the party host for a new one." : "Couldn't record the waiver.");
  return ok();
}
