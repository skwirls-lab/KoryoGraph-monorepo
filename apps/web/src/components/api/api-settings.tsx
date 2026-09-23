"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { API_SCOPES, WEBHOOK_EVENTS } from "@/lib/public-api";
import { createApiKey, createWebhook, deleteWebhook, revokeApiKey } from "@/server/actions/api-settings";

function Secret({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="space-y-1 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm" role="status">
      <p><strong>{label}</strong> — copy it now; it won&apos;t be shown again.</p>
      <code className="block break-all rounded bg-background p-2 font-mono text-xs" data-testid={testId}>{value}</code>
      <Button size="sm" variant="outline" type="button" onClick={() => void navigator.clipboard?.writeText(value).then(() => toast.success("Copied"))}>Copy</Button>
    </div>
  );
}

export function NewApiKey() {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(API_SCOPES);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-3">
      {key ? <Secret label="Your new API key" value={key} testId="new-api-key" /> : null}
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        start(async () => { setError(null); const r = await createApiKey({ name, scopes }); if (r.ok) { setKey(r.data.key); setName(""); router.refresh(); } else setError(r.error); });
      }}>
        <div className="max-w-sm space-y-1"><Label htmlFor="key-name">Key name</Label><Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Accounting sync" /></div>
        <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="mb-1 text-sm font-medium">Can read</legend>
          {API_SCOPES.map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--color-primary)]" checked={scopes.includes(s)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />{s.replace(":read", "")}</label>)}
        </fieldset>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={pending}>Create key</Button>
      </form>
    </div>
  );
}

export function RevokeKey({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <Button size="sm" variant="ghost" disabled={pending} aria-label={`Revoke ${name}`} onClick={() => { if (confirm(`Revoke "${name}"? Anything using it stops working immediately.`)) start(async () => { const r = await revokeApiKey({ id }); if (r.ok) router.refresh(); else toast.error(r.error); }); }}>Revoke</Button>;
}

export function NewWebhook() {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["member.created"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-3">
      {secret ? <Secret label="Signing secret" value={secret} testId="new-webhook-secret" /> : null}
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        start(async () => { setError(null); const r = await createWebhook({ url, events }); if (r.ok) { setSecret(r.data.secret); setUrl(""); router.refresh(); } else setError(r.error); });
      }}>
        <div className="max-w-lg space-y-1"><Label htmlFor="wh-url">Endpoint URL</Label><Input id="wh-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/koryograph" /></div>
        <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="mb-1 text-sm font-medium">Events</legend>
          {WEBHOOK_EVENTS.map((ev) => <label key={ev} className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--color-primary)]" checked={events.includes(ev)} onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))} />{ev}</label>)}
        </fieldset>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={pending}>Add endpoint</Button>
      </form>
    </div>
  );
}

export function RemoveWebhook({ id, url }: { id: string; url: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <Button size="sm" variant="ghost" disabled={pending} aria-label={`Remove ${url}`} onClick={() => start(async () => { const r = await deleteWebhook({ id }); if (r.ok) router.refresh(); else toast.error(r.error); })}>Remove</Button>;
}
