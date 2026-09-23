import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { NewApiKey, NewWebhook, RemoveWebhook, RevokeKey } from "@/components/api/api-settings";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "API & webhooks" };
const card = "rounded-xl border border-default bg-surface p-4 sm:p-6";

export default async function ApiSettings() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const [{ data: keys }, { data: hooks }, { data: deliveries }] = await Promise.all([
    ctx.supabase.from("api_keys").select("id, name, prefix, scopes, last_used_at, request_count, revoked_at, created_at").order("created_at", { ascending: false }),
    ctx.supabase.from("webhook_endpoints").select("id, url, events, active, created_at").order("created_at"),
    ctx.supabase.from("webhook_deliveries").select("id, event, status, attempts, last_error, created_at, webhook_endpoints(url)").order("created_at", { ascending: false }).limit(15),
  ]);
  const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "medium", timeStyle: "short" }) : "never");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="API & webhooks" description="Read your school's data from other tools, and get notified when things happen." />
      <div className="space-y-6">
        <section aria-labelledby="keys-h" className={card}>
          <h2 id="keys-h" className="mb-1 text-base font-semibold">API keys</h2>
          <p className="mb-4 text-sm text-fg-secondary">Read-only, 120 requests a minute per key. <a href="/api/v1/openapi.json">OpenAPI description</a> · <code className="text-xs">GET /api/v1/people</code> with <code className="text-xs">Authorization: Bearer kg_live_…</code></p>
          {keys?.length ? (
            <ul className="mb-4 divide-y divide-default text-sm" aria-label="API keys">
              {keys.map((k) => (
                <li key={k.id} aria-label={k.name} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-medium">{k.name}</span><code className="text-xs text-fg-muted">{k.prefix}_…</code>
                  {k.revoked_at ? <Badge variant="outline">revoked</Badge> : null}
                  <span className="text-xs text-fg-muted">{k.scopes.map((s) => s.replace(":read", "")).join(", ")} · last used {when(k.last_used_at)} · {k.request_count} requests</span>
                  {!k.revoked_at ? <span className="ml-auto"><RevokeKey id={k.id} name={k.name} /></span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <NewApiKey />
        </section>
        <section aria-labelledby="hooks-h" className={card}>
          <h2 id="hooks-h" className="mb-1 text-base font-semibold">Webhooks</h2>
          <p className="mb-4 text-sm text-fg-secondary">We POST a JSON event, signed with <code className="text-xs">KoryoGraph-Signature: t=…,v1=HMAC-SHA256(secret, &quot;t.body&quot;)</code>, and retry for about 15 hours.</p>
          {hooks?.length ? (
            <ul className="mb-4 divide-y divide-default text-sm" aria-label="Webhook endpoints">
              {hooks.map((h) => <li key={h.id} className="flex flex-wrap items-center gap-2 py-2"><span className="break-all font-medium">{h.url}</span><span className="text-xs text-fg-muted">{h.events.join(", ")}</span><span className="ml-auto"><RemoveWebhook id={h.id} url={h.url} /></span></li>)}
            </ul>
          ) : null}
          <NewWebhook />
          {deliveries?.length ? (
            <>
              <h3 className="mt-6 mb-2 text-sm font-semibold">Recent deliveries</h3>
              <ul className="divide-y divide-default text-sm" aria-label="Recent deliveries">
                {deliveries.map((d) => <li key={d.id} className="flex flex-wrap gap-2 py-1.5"><span>{d.event}</span><Badge variant={d.status === "delivered" ? "secondary" : "outline"}>{d.status}</Badge><span className="text-xs text-fg-muted">{d.attempts} attempt{d.attempts === 1 ? "" : "s"}{d.last_error ? ` · ${d.last_error}` : ""} · {when(d.created_at)}</span></li>)}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
