"use server";

import { createAnonClient } from "@koryo/db/anon";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const contactSchema = z.object({
  name: z.string().trim().min(1, { error: "Tell us your name" }).max(120),
  email: z.email({ error: "Enter a valid email" }).max(254),
  school: z.string().trim().max(160).optional(),
  topic: z.enum(["general", "demo", "pricing", "support", "privacy"]),
  message: z.string().trim().min(10, { error: "Write a little more so we can help" }).max(5000),
  website: z.string().max(200).optional(),
});

/** /contact → the platform inbox (public.contact_messages via a rate-limited RPC; honeypot field `website`). */
export async function submitContact(input: z.input<typeof contactSchema>): Promise<ActionResult> {
  const v = contactSchema.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Check the form");
  const { error } = await createAnonClient().rpc("submit_contact", { p: v.data });
  if (error) return fail(error.code === "22023" ? error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." : "We couldn't send your message. Email us instead.");
  return ok();
}
