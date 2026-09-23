import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./public-env";
import type { Database } from "./types";

/**
 * Sessionless anon client. Used by device-authenticated surfaces (the kiosk), whose permissions come
 * from security-definer RPCs that validate a device token — never from a user's cookie.
 */
export function createAnonClient(): SupabaseClient<Database> {
  const env = publicEnv();
  return createClient<Database>(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
