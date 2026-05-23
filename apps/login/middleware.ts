import { createSupabaseServerClient } from "@repo/database";
import { NextResponse, type NextRequest } from "next/server";
import type { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";

/**
 * Proxy (formerly middleware): Session guard for the login app.
 *
 * - Refreshes Supabase session cookies on every request (keeps auth alive).
 * - If the user is already authenticated and lands on the login root (/),
 *   redirect them to the appropriate app based on their role.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Type-safe cookie adapter for our shared createSupabaseServerClient
  const cookieAdapter = {
    get: (name: string) => {
      const cookie = request.cookies.get(name);
      return cookie ? { name: cookie.name, value: cookie.value } : undefined;
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      const cookieOpts = { name, value, ...options } as RequestCookie;
      response.cookies.set(cookieOpts);
    },
    delete: (name: string, options: Record<string, unknown>) => {
      const cookieOpts = { name, value: "", ...options } as RequestCookie;
      response.cookies.set(cookieOpts);
    },
  };

  const supabase = createSupabaseServerClient(cookieAdapter);

  // Refresh the session (Supabase SSR handles rotating JWTs automatically)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If user is already logged in and lands on the login root, redirect them
  if (session && request.nextUrl.pathname === "/") {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", session.user.id);

    const roleIds = (roles ?? []).map((r: { role_id: string }) => r.role_id);
    const IS_PROD = process.env.NODE_ENV === "production";
    const DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";

    let redirectUrl: string;
    if (roleIds.includes("owner") || roleIds.includes("admin")) {
      redirectUrl = IS_PROD ? `https://desk.${DOMAIN}` : "http://localhost:3002";
    } else if (roleIds.includes("instructor")) {
      redirectUrl = IS_PROD ? `https://app.${DOMAIN}` : "http://localhost:3001";
    } else {
      redirectUrl = IS_PROD ? `https://home.${DOMAIN}` : "http://localhost:3003";
    }

    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
