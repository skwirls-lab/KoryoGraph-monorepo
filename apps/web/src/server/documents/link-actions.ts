"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAnonClient } from "@koryo/db/anon";
import { fail, ok, type ActionResult } from "@/lib/action-result";

// Signing links: no session; the token is validated by complete_signature_request() in the database.
// The PDF is rendered by the signature_pdfs job (service role).
export async function completeSigningLink(input: { token: string; typedName: string; agree: boolean }): Promise<ActionResult> {
  const parsed = z.object({ token: z.string().min(20).max(100), typedName: z.string().trim().min(2, { error: "Type your full name" }).max(120), agree: z.literal(true, { error: "Tick the box to agree" }) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid signature");
  const h = await headers();
  const { error } = await createAnonClient().rpc("complete_signature_request", {
    p_token: parsed.data.token, p_typed_name: parsed.data.typedName,
    p_ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "", p_user_agent: h.get("user-agent") ?? "",
  });
  if (error) return fail(/expired|invalid/.test(error.message) ? "This signing link is invalid or has expired. Ask the school for a new one." : /already/.test(error.message) ? "This document was already signed." : "Couldn't record your signature.");
  return ok();
}
