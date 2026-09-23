import webpush from "web-push";
import type { ServiceClient } from "@koryo/db/service";

/** Web push is sent only when the server has VAPID keys; otherwise notifications stay in-app (and the UI says so). */
export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** Push a notification to every browser the person's account subscribed; drops subscriptions the push service says are gone. */
export async function pushToPerson(db: ServiceClient, personId: string, payload: { title: string; body: string; url: string }): Promise<{ sent: number; removed: number }> {
  if (!pushConfigured()) return { sent: 0, removed: 0 };
  const { data: person } = await db.from("people").select("user_id, tenant_id").eq("id", personId).maybeSingle();
  if (!person?.user_id) return { sent: 0, removed: 0 };
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", person.user_id).eq("tenant_id", person.tenant_id);
  webpush.setVapidDetails(`mailto:${process.env.PUSH_CONTACT_EMAIL ?? "support@koryograph.app"}`, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string, process.env.VAPID_PRIVATE_KEY as string);
  let sent = 0;
  let removed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86_400 });
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await db.from("push_subscriptions").delete().eq("id", s.id); removed++; }
    }
  }
  return { sent, removed };
}
