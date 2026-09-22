import { createServerClient as createSsrServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";
import type { Database } from "./types";

export type ServerClient = SupabaseClient<Database>;
export type { CookieOptions };

export interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Cookie store contract. Next's `cookies()` satisfies it via getAll/set; the proxy passes a `setAll`
 * that also rewrites the forwarded request so the refreshed session is visible downstream.
 */
export interface CookieStore {
  getAll(): { name: string; value: string }[];
  set?(name: string, value: string, options: CookieOptions): void;
  setAll?(cookies: CookieToSet[]): void;
}

export interface ServerClientOptions {
  /** Extra headers forwarded to PostgREST (x-request-id, x-client-ip → audit_events). */
  headers?: Record<string, string>;
}

/**
 * User-scoped server client (RLS enforced). Reads every cookie via getAll and writes refreshed session
 * cookies via setAll. In a Server Component render cookies are read-only; Next throws on set there,
 * which is safe to ignore because the proxy refreshes the session on every request.
 */
export function createServerClient(store: CookieStore, opts: ServerClientOptions = {}): ServerClient {
  const env = publicEnv();
  return createSsrServerClient<Database>(env.url, env.anonKey, {
    global: opts.headers ? { headers: opts.headers } : undefined,
    cookieOptions: env.cookieDomain ? { domain: env.cookieDomain, path: "/", sameSite: "lax" } : undefined,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookies) => {
        if (store.setAll) {
          store.setAll(cookies);
          return;
        }
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
