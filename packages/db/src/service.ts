import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serviceEnv } from "./env";
import type { Database } from "./types";

export type ServiceClient = SupabaseClient<Database>;

/**
 * Service-role client — bypasses RLS. Allowed only in webhooks, jobs, and platform-admin code
 * (`src/server/admin/**`, `src/app/api/(stripe|jobs|webhooks)`); a security test enforces this.
 */
export function createServiceClient(): ServiceClient {
  const env = serviceEnv();
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
