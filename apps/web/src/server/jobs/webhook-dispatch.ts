import { createHmac } from "node:crypto";
import type { Job, JobStats } from "./types";

// Backoff after each failed attempt; delivery is marked failed after the last.
const BACKOFF_MIN = [1, 5, 30, 120, 720];

/** Refuse obviously internal destinations in production (localhost, private and link-local ranges). */
export function blockedDestination(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return "invalid URL"; }
  if (process.env.NODE_ENV !== "production") return null;
  if (u.protocol !== "https:") return "webhooks must use https";
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return "internal host";
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === "::1" || h.startsWith("[")) return "private address";
  return null;
}

export function signature(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** Every minute: POST due deliveries (HMAC-signed), retry with backoff, give up after 6 attempts. */
export const webhookDispatch: Job = async ({ db, now, tenantId, log }) => {
  let q = db.from("webhook_deliveries").select("id, tenant_id, event, payload, attempts, webhook_endpoints(url, secret, active)")
    .eq("status", "pending").lte("next_attempt_at", now.toISOString()).order("next_attempt_at").limit(50);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) throw new Error(`webhook_deliveries: ${error.message}`);
  const stats: JobStats = { attempted: 0, delivered: 0, retrying: 0, failed: 0 };
  for (const d of data ?? []) {
    const ep = d.webhook_endpoints;
    const attempts = d.attempts + 1;
    const giveUp = (msg: string) => db.from("webhook_deliveries").update({ status: "failed", attempts, last_error: msg.slice(0, 500), next_attempt_at: null }).eq("id", d.id);
    if (!ep || !ep.active) { await giveUp("endpoint removed or disabled"); stats.failed = Number(stats.failed) + 1; continue; }
    const blocked = blockedDestination(ep.url);
    if (blocked) { await giveUp(`refused: ${blocked}`); stats.failed = Number(stats.failed) + 1; continue; }
    stats.attempted = Number(stats.attempted) + 1;
    const body = JSON.stringify(d.payload);
    const t = Math.floor(Date.now() / 1000);
    let err: string | null = null;
    try {
      const res = await fetch(ep.url, {
        method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
        headers: { "content-type": "application/json", "user-agent": "KoryoGraph-Webhooks/1", "koryograph-event": d.event, "koryograph-delivery": d.id, "koryograph-signature": `t=${t},v1=${signature(ep.secret, t, body)}` },
        body,
      });
      if (res.status < 200 || res.status >= 300) err = `HTTP ${res.status}`;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    if (!err) {
      await db.from("webhook_deliveries").update({ status: "delivered", attempts, last_error: null, next_attempt_at: null }).eq("id", d.id);
      stats.delivered = Number(stats.delivered) + 1;
    } else if (attempts > BACKOFF_MIN.length) {
      await giveUp(err);
      stats.failed = Number(stats.failed) + 1;
    } else {
      await db.from("webhook_deliveries").update({ attempts, last_error: err.slice(0, 500), next_attempt_at: new Date(now.getTime() + (BACKOFF_MIN[attempts - 1] ?? 720) * 60_000).toISOString() }).eq("id", d.id);
      stats.retrying = Number(stats.retrying) + 1;
    }
  }
  if (Number(stats.attempted)) log.info(stats, "webhooks");
  return stats;
};
