import { verifySvix } from "@koryo/comms/webhooks";
import { createServiceClient } from "@koryo/db/service";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/server/log";

export const dynamic = "force-dynamic";

const event = z.object({
  type: z.string(),
  data: z.object({ email_id: z.string().optional(), to: z.union([z.string(), z.array(z.string())]).optional(), from: z.string().optional(), text: z.string().optional(), subject: z.string().optional() }).loose(),
});

/**
 * Resend webhooks (Svix-signed): delivery events update `communications`; inbound replies addressed to
 * reply+<threadId>@… are appended to that conversation.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Resend webhooks are not configured" }, { status: 503 });
  const raw = await request.text();
  const ok = verifySvix(secret, { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature") }, raw);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  const parsed = event.safeParse(JSON.parse(raw) as unknown);
  if (!parsed.success) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  const db = createServiceClient();
  const { type, data } = parsed.data;
  const statusFor: Record<string, string> = { "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "failed", "email.delivery_delayed": "sent" };
  if (statusFor[type] && data.email_id) {
    await db.from("communications").update({ status: statusFor[type] }).eq("provider_message_id", data.email_id);
    return NextResponse.json({ ok: true });
  }
  if (type === "email.received") {
    const to = [data.to ?? []].flat().join(" ");
    const threadId = /reply\+([0-9a-f-]{36})@/i.exec(to)?.[1];
    if (threadId && data.text) {
      const { data: thread } = await db.from("message_threads").select("id, tenant_id, household_id").eq("id", threadId).maybeSingle();
      if (thread) {
        await db.from("thread_messages").insert({ tenant_id: thread.tenant_id, thread_id: thread.id, from_staff: false, body: data.text.slice(0, 5000) });
        return NextResponse.json({ ok: true });
      }
    }
    logger().child({ webhook: "resend" }).warn({ to }, "inbound email with no matching conversation");
  }
  return NextResponse.json({ ok: true, ignored: type });
}
