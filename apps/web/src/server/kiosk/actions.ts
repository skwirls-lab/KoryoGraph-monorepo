"use server";

import { z } from "zod";
import { createAnonClient } from "@koryo/db/anon";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logger } from "../log";
import { kioskToken } from "./device";

// Device-authenticated actions: the kiosk cookie's token is validated by each RPC in the database.
// They live outside src/server/actions/** because there is no user session (no getCtx()).

async function device(): Promise<{ token: string } | { error: ReturnType<typeof fail> }> {
  const token = await kioskToken();
  return token ? { token } : { error: fail("This device isn't paired. Ask a staff member.") };
}

export async function kioskSearch(q: string): Promise<ActionResult<{ personId: string; name: string; household: string | null }[]>> {
  const d = await device();
  if ("error" in d) return d.error;
  if (q.trim().length < 2) return ok([]);
  const { data, error } = await createAnonClient().rpc("kiosk_search", { p_token: d.token, p_q: q.slice(0, 40) });
  if (error) return fail("Search isn't available right now.");
  return ok((data ?? []).map((r) => ({ personId: r.person_id, name: r.display_name, household: r.household_name })));
}

export interface KioskFamily {
  householdId: string;
  householdName: string;
  hasPin: boolean;
  lockedUntil: string | null;
  members: { personId: string; name: string }[];
}

export async function kioskFamily(personId: string): Promise<ActionResult<KioskFamily>> {
  const d = await device();
  if ("error" in d) return d.error;
  if (!z.uuid().safeParse(personId).success) return fail("Unknown student");
  const { data, error } = await createAnonClient().rpc("kiosk_family", { p_token: d.token, p_person_id: personId });
  const first = data?.[0];
  if (error || !first) return fail("We couldn't find this family. Please see the front desk.");
  return ok({
    householdId: first.household_id,
    householdName: first.household_name,
    hasPin: first.has_pin,
    lockedUntil: first.locked_until,
    members: (data ?? []).map((r) => ({ personId: r.person_id, name: r.display_name })),
  });
}

export async function kioskUnlock(householdId: string, pin: string): Promise<ActionResult<{ ok: boolean; attemptsLeft: number; lockedUntil: string | null }>> {
  const d = await device();
  if ("error" in d) return d.error;
  if (!z.uuid().safeParse(householdId).success) return fail("Unknown family");
  const { data, error } = await createAnonClient().rpc("kiosk_unlock", { p_token: d.token, p_household_id: householdId, p_pin: pin.slice(0, 4) });
  const r = data?.[0];
  if (error || !r) return fail(error?.message.includes("no PIN") ? "No PIN is set for this family yet — please see the front desk." : "Couldn't check the PIN.");
  return ok({ ok: r.ok, attemptsLeft: r.attempts_left, lockedUntil: r.locked_until });
}

export interface KioskSession {
  personId: string;
  sessionId: string;
  name: string;
  startsAt: string;
  suggested: boolean;
  alreadyIn: boolean;
}

export async function kioskSessions(personIds: string[]): Promise<ActionResult<KioskSession[]>> {
  const d = await device();
  if ("error" in d) return d.error;
  const ids = z.array(z.uuid()).max(10).safeParse(personIds);
  if (!ids.success) return fail("Invalid selection");
  const { data, error } = await createAnonClient().rpc("kiosk_sessions", { p_token: d.token, p_person_ids: ids.data });
  if (error) return fail("Couldn't load today's classes.");
  return ok((data ?? []).map((r) => ({ personId: r.person_id, sessionId: r.session_id, name: r.name, startsAt: r.starts_at, suggested: r.suggested, alreadyIn: r.already_in })));
}

const items = z.array(z.object({ person_id: z.uuid(), session_id: z.uuid() })).min(1).max(10);

export async function kioskCheckIn(input: { householdId: string; pin: string | null; items: { person_id: string; session_id: string }[] }): Promise<ActionResult<{ checkedIn: number }>> {
  const d = await device();
  if ("error" in d) return d.error;
  const parsed = z.object({ householdId: z.uuid(), pin: z.string().regex(/^\d{4}$/).nullable(), items }).safeParse(input);
  if (!parsed.success) return fail("Pick at least one class");
  const client = createAnonClient();
  const { data, error } = parsed.data.pin
    ? await client.rpc("kiosk_check_in", { p_token: d.token, p_household_id: parsed.data.householdId, p_pin: parsed.data.pin, p_items: parsed.data.items })
    : await client.rpc("kiosk_check_in_confirmed", { p_token: d.token, p_household_id: parsed.data.householdId, p_items: parsed.data.items });
  if (error) {
    logger().warn({ err: error.message }, "kiosk check-in failed");
    return fail("Check-in didn't go through. Please see the front desk.");
  }
  return ok({ checkedIn: data ?? 0 });
}

export async function kioskUnsigned(personIds: string[]): Promise<ActionResult<{ personId: string; templateName: string }[]>> {
  const d = await device();
  if ("error" in d) return d.error;
  const ids = z.array(z.uuid()).max(10).safeParse(personIds);
  if (!ids.success) return fail("Invalid selection");
  const { data, error } = await createAnonClient().rpc("kiosk_unsigned", { p_token: d.token, p_person_ids: ids.data });
  if (error) return ok([]);
  return ok((data ?? []).map((r) => ({ personId: r.person_id, templateName: r.template_name })));
}
