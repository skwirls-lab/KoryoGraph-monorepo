import { createServiceClient } from "@koryo/db/service";
import { stripeFromEnv, verifyWebhook } from "@koryo/payments";
import { NextResponse, type NextRequest } from "next/server";
import { processStripeEvent } from "@/server/admin/stripe/events";
import { logger } from "@/server/log";

export const dynamic = "force-dynamic";

/**
 * Stripe Connect webhook (F7.8). Signature-verified against STRIPE_WEBHOOK_SECRET; each event is applied
 * once (stripe_events). A handler failure returns 500 so Stripe redelivers it.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = stripeFromEnv();
  if (!secret || !stripe) return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  const raw = await request.text();
  let event;
  try {
    event = verifyWebhook(stripe, raw, request.headers.get("stripe-signature"), secret);
  } catch (err) {
    logger().child({ webhook: "stripe" }).warn({ err: err instanceof Error ? err.message : String(err) }, "rejected stripe webhook");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const result = await processStripeEvent(createServiceClient(), event, { stripe: process.env.STRIPE_SECRET_KEY ? stripe : null });
  if (result.outcome === "failed") return NextResponse.json({ error: result.detail }, { status: 500 });
  return NextResponse.json({ received: true, outcome: result.outcome });
}
