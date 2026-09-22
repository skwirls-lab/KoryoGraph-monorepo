import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/surfaces";
import { logger } from "@/server/log";
import { supabaseServer } from "@/server/supabase";

/** OAuth / magic-link / password-reset PKCE code exchange. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/auth/landing");
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", request.url));

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger().info({ reason: error.code }, "auth code exchange failed");
    return NextResponse.redirect(new URL("/login?error=link_expired", request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}
