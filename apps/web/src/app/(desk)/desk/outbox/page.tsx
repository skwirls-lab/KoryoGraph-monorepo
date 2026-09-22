import Link from "next/link";
import { forbidden } from "next/navigation";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { ResendButton } from "@/components/messaging/resend-button";
import { requireSurfacePage } from "@/server/context";
import { listOutbox } from "@/server/queries/messaging";

export const metadata = { title: "Outbox" };

const STATUSES = ["unsent_no_provider", "queued", "deferred", "sent", "delivered", "failed", "opted_out", "no_address", "bounced"] as const;

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ status?: string; channel?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("comms.send")) forbidden();
  const sp = await searchParams;
  const rows = await listOutbox(ctx, { status: sp.status, channel: sp.channel });
  const emailReady = Boolean(process.env.RESEND_API_KEY);
  const smsReady = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg";
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/inbox">Inbox</Link>} title="Outbox" description="Every message KoryoGraph has sent or tried to send." />
      <div role="status" className="mb-4 rounded-xl border border-default bg-surface p-4 text-sm">
        <p>Email provider: <strong>{emailReady ? "connected (Resend)" : "not configured"}</strong> · SMS provider: <strong>{smsReady ? "connected (Twilio)" : "not configured"}</strong></p>
        {!emailReady || !smsReady ? <p className="text-fg-secondary">Messages for a channel without a provider are kept here as <em>unsent — no provider</em>. Nothing is silently dropped; resend them once a provider is connected.</p> : null}
      </div>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">Status
          <select name="status" defaultValue={sp.status ?? ""} className={selectClass}>
            <option value="" className="bg-surface">All</option>
            {STATUSES.map((s) => <option key={s} value={s} className="bg-surface">{s.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">Channel
          <select name="channel" defaultValue={sp.channel ?? ""} className={selectClass}>
            <option value="" className="bg-surface">All</option>
            {["email", "sms", "inapp"].map((c) => <option key={c} value={c} className="bg-surface">{c}</option>)}
          </select>
        </label>
        <Button type="submit" size="sm" variant="secondary">Filter</Button>
      </form>
      {rows.length === 0 ? <EmptyState title="Nothing here" /> : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <Table>
            <caption className="sr-only">Outbox</caption>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>To</TableHead><TableHead>Channel</TableHead><TableHead>Message</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap text-xs"><DateText value={c.created_at} timeZone={ctx.tz} style="datetime" /></TableCell>
                  <TableCell className="text-sm">{c.people ? `${c.people.first_name} ${c.people.last_name}` : "—"}<div className="text-xs text-fg-muted">{c.to_address ?? ""}</div></TableCell>
                  <TableCell>{c.channel}</TableCell>
                  <TableCell className="max-w-sm"><div className="truncate text-sm">{c.subject ?? c.body_text}</div><div className="text-xs text-fg-muted">{c.template_key?.replace(/_/g, " ")}</div></TableCell>
                  <TableCell><Badge variant="outline">{c.status.replace(/_/g, " ")}</Badge>{c.error ? <div className="text-xs text-danger">{c.error}</div> : null}{c.scheduled_for && c.status === "deferred" ? <div className="text-xs text-fg-muted">after <DateText value={c.scheduled_for} timeZone={ctx.tz} style="time" /></div> : null}</TableCell>
                  <TableCell>{c.status === "unsent_no_provider" || c.status === "failed" ? <ResendButton id={c.id} /> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
