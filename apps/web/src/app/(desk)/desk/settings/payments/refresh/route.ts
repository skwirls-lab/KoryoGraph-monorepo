import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/server/context";
import { onboardingLink } from "@/server/payments/stripe";

export const dynamic = "force-dynamic";

/** Stripe calls this when an onboarding link has expired; hand the owner a fresh one. */
export async function GET(request: NextRequest) {
  const ctx = await getCtx();
  const back = new URL("/desk/settings/payments", request.url);
  if (!ctx.permissions.has("settings.manage")) return NextResponse.redirect(back);
  try {
    const url = await onboardingLink(ctx);
    return NextResponse.redirect(url ?? back);
  } catch {
    back.searchParams.set("stripe", "error");
    return NextResponse.redirect(back);
  }
}
