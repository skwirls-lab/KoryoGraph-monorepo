import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient, type ServerClient } from "@koryo/db/server";

/** User-scoped Supabase client for the current request (RLS enforced). Forwards request id + client IP for audit. */
export async function supabaseServer(): Promise<ServerClient> {
  const [store, h] = await Promise.all([cookies(), headers()]);
  const forwarded: Record<string, string> = {};
  const requestId = h.get("x-request-id");
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  if (requestId) forwarded["x-request-id"] = requestId;
  if (ip) forwarded["x-client-ip"] = ip;
  return createServerClient(store, { headers: forwarded });
}
