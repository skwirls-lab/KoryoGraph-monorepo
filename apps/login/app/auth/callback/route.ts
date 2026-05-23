import { createSupabaseServerClient } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /auth/callback
 *
 * Supabase OAuth callback handler.
 * After Google/Apple sign-in, Supabase redirects here with a `code` param.
 * We exchange the code for a session, then redirect the user to the correct
 * app based on their assigned role.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    // If no code, redirect to login with an error
    return NextResponse.redirect(
      new URL("/?error=oauth_no_code", requestUrl.origin)
    );
  }

  const cookieStore = await cookies();

  const supabase = createSupabaseServerClient({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string, options) =>
      cookieStore.set({ name, value, ...options }),
    delete: (name: string, options) =>
      cookieStore.delete({ name, ...options }),
  });

  // Exchange the OAuth code for a Supabase session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("[OAuth Callback] Failed to exchange code:", error?.message);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error?.message ?? "session_failed")}`, requestUrl.origin)
    );
  }

  // Determine redirect URL based on user roles
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", data.session.user.id);

  if (rolesError || !roles || roles.length === 0) {
    console.error("[OAuth Callback] Failed to fetch roles:", rolesError?.message);
    return NextResponse.redirect(
      new URL("/?error=no_roles_assigned", requestUrl.origin)
    );
  }

  const roleIds = roles.map((r: { role_id: string }) => r.role_id);
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
