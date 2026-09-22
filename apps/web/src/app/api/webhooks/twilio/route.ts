import { verifyTwilio } from "@koryo/comms/webhooks";
import { createServiceClient } from "@koryo/db/service";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/server/log";

export const dynamic = "force-dynamic";

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const digits = (p: string) => p.replace(/\D/g, "").slice(-10);

/**
 * Twilio webhooks (signature-verified): delivery status callbacks update `communications`; inbound SMS to
 * a school's number (tenants.settings.sms_number) is appended to that family's open conversation.
 */
export async function POST(request: NextRequest) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return NextResponse.json({ error: "Twilio is not configured" }, { status: 503 });
  const params = Object.fromEntries(new URLSearchParams(await request.text())) as Record<string, string>;
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!verifyTwilio(token, publicUrl, params, request.headers.get("x-twilio-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }
  const db = createServiceClient();
  const log = logger().child({ webhook: "twilio" });

  if (params.MessageStatus && params.MessageSid && !params.Body) {
    const status = params.MessageStatus === "delivered" ? "delivered" : ["failed", "undelivered"].includes(params.MessageStatus) ? "failed" : null;
    if (status) await db.from("communications").update({ status, error: params.ErrorCode ? `Twilio ${params.ErrorCode}` : null }).eq("provider_message_id", params.MessageSid);
    return new NextResponse(TWIML_OK, { headers: { "content-type": "text/xml" } });
  }

  const { data: tenant } = await db.from("tenants").select("id").eq("settings->>sms_number", params.To ?? "").maybeSingle();
  if (!tenant) {
    log.warn({ to: params.To }, "inbound SMS to an unmapped number");
    return new NextResponse(TWIML_OK, { headers: { "content-type": "text/xml" } });
  }
  const { data: candidates } = await db.from("people").select("id, phone").eq("tenant_id", tenant.id).not("phone", "is", null);
  const person = (candidates ?? []).find((p) => p.phone && digits(p.phone) === digits(params.From ?? ""));
  const { data: membership } = person ? await db.from("household_members").select("household_id").eq("person_id", person.id).limit(1).maybeSingle() : { data: null };
  const body = (params.Body ?? "").trim();
  const { data: comm } = await db.from("communications").insert({
    tenant_id: tenant.id, channel: "sms", direction: "in", person_id: person?.id ?? null, household_id: membership?.household_id ?? null,
    to_address: params.To, body_text: body, status: "delivered", provider: "twilio", provider_message_id: params.MessageSid ?? null,
  }).select("id").single();
  if (membership && body) {
    const { data: open } = await db.from("message_threads").select("id").eq("household_id", membership.household_id).eq("status", "open").order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    const threadId = open?.id ?? (await db.from("message_threads").insert({ tenant_id: tenant.id, household_id: membership.household_id, subject: "Text message" }).select("id").single()).data?.id;
    if (threadId) await db.from("thread_messages").insert({ tenant_id: tenant.id, thread_id: threadId, sender_person_id: person?.id ?? null, from_staff: false, body, communication_id: comm?.id ?? null });
  }
  return new NextResponse(TWIML_OK, { headers: { "content-type": "text/xml" } });
}
