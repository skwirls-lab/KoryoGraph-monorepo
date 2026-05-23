import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// 1. BROWSER CLIENT (For React Client Components)
// ============================================================
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase Environment Variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined."
    );
  }

  return createBrowserClient(url, anonKey);
}

// ============================================================
// 2. SERVER CLIENT HELPER (For Next.js Server Components, Actions, & Middleware)
//    Accepts a generic cookie store object to remain framework-independent.
// ============================================================
export interface CookieStore {
  get: (name: string) => { name: string; value: string } | undefined;
  set: (name: string, value: string, options: CookieOptions) => void;
  delete: (name: string, options: CookieOptions) => void;
}

export function createSupabaseServerClient(cookieStore: CookieStore) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase Environment Variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        // Required by Supabase SSR API
        return [];
      },
      setAll() {
        // Required by Supabase SSR API
      },
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.delete(name, options);
        } catch {
          // Ignored if called from a Server Component.
        }
      },
    },
    // SSO Cookie Configuration: Sharing auth cookie across subdomains (*.koryograph.ai)
    cookieOptions: {
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost",
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    },
  });
}

// ============================================================
// 3. SERVICE ROLE CLIENT (For Serverless Functions, secure bypass APIs)
//    WARNING: NEVER expose this client or the key on the browser!
// ============================================================
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase Admin Credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
