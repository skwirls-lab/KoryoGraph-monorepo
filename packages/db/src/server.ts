import { createServerClient as createSsrServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";
import type { Database } from "./types";

export type ServerClient = SupabaseClient<Database>;

/** Minimal cookie store contract satisfied by Next's `cookies()` and by middleware request/response pairs. */
export interface CookieStore {
  getAll(): { name: string; value: string }[];
  set?(name: string, value: string, options: CookieOptions): void;
}

/**
 * User-scoped server client (RLS enforced). Reads every cookie via getAll and writes refreshed
 * session cookies via setAll. In a Server Component render cookies are read-only; Next throws on
 * set there, which is safe to ignore because middleware refreshes the session on every request.
 */
export function createServerClient(store: CookieStore): ServerClient {
  const env = publicEnv();
  return createSsrServerClient<Database>(env.url, env.anonKey, {
    cookieOptions: env.cookieDomain ? { domain: env.cookieDomain, path: "/", sameSite: "lax" } : undefined,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookies) => {
        if (!store.set) return;
        for (const { name, value, options } of cookies) {
          try {
            store.set(name, value, options);
          } catch (err) {
            if (!(err instanceof Error) || !/Cookies can only be modified/i.test(err.message)) throw err;
          }
        }
      },
    },
  });
}
