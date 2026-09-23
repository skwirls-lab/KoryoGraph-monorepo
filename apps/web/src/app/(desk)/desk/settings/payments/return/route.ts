import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/server/context";
import { syncAccountStatus } from "@/server/payments/stripe";

export const dynamic = "force-dynamic";

/** Stripe sends the owner back here after onboarding; record the account's status and show the settings page. */
export async function GET(request: NextRequest) {
  const ctx = await getCtx();
  const target = new URL("/desk/settings/payments", request.url);
  if (!ctx.permissions.has("settings.manage")) return NextResponse.redirect(target);
  const result = await syncAccountStatus(ctx);
  target.searchParams.set("stripe", result.ok ? (result.data.complete ? "connected" : "incomplete") : "error");
  return NextResponse.redirect(target);
}
