import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/surfaces";
import { supabaseServer } from "@/server/supabase";

const TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Token-hash confirmation links (custom email templates using {{ .TokenHash }}). */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/auth/landing");
  const otpType = TYPES.find((t) => t === type);
  if (!tokenHash || !otpType) return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash });
  if (error) return NextResponse.redirect(new URL("/login?error=link_expired", request.url));
  return NextResponse.redirect(new URL(next, request.url));
}
