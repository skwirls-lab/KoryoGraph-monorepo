import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./public-env";
import type { Database } from "./types";

export type BrowserClient = SupabaseClient<Database>;

/**
 * Browser Supabase client. The cookie domain is shared across subdomains (desk./app./home.) when
 * NEXT_PUBLIC_COOKIE_DOMAIN is set, so one sign-in covers every surface.
 */
export function createBrowserClient(): BrowserClient {
  const env = publicEnv();
  return createSsrBrowserClient<Database>(env.url, env.anonKey, {
    cookieOptions: env.cookieDomain ? { domain: env.cookieDomain, path: "/", sameSite: "lax" } : undefined,
  });
}
