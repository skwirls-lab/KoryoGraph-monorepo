import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Broadcast" };
const LABEL: Record<string, string> = { queued: "Queued", sent: "Sent", delivered: "Delivered", unsent_no_provider: "Not sent — no provider configured", opted_out: "Opted out", deferred: "Deferred (quiet hours)", failed: "Failed", bounced: "Bounced", no_address: "No address" };

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("comms.send")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: c }, { data: comms }] = await Promise.all([
    ctx.supabase.from("campaigns").select("*").eq("id", id).maybeSingle(),
    ctx.supabase.from("communications").select("status").eq("campaign_id", id),
  ]);
  if (!c) notFound();
  const counts = new Map<string, number>();
  for (const m of comms ?? []) counts.set(m.status, (counts.get(m.status) ?? 0) + 1);
  const stats = c.stats as { queued?: number; no_consent?: number };
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/broadcasts">Broadcasts</Link>} title={c.name} description={`${c.channel === "sms" ? "Text" : "Email"} · sent ${c.sent_at ? new Date(c.sent_at).toLocaleString("en-US", { timeZone: ctx.tz }) : "—"}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="stats-h">
          <h2 id="stats-h" className="mb-3 text-base font-semibold">Delivery</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Messages</dt><dd className="tabular font-semibold">{comms?.length ?? 0}</dd></div>
            {[...counts.entries()].map(([s, n]) => <div key={s} className="flex justify-between"><dt className="text-fg-secondary">{LABEL[s] ?? s}</dt><dd className="tabular">{n}</dd></div>)}
            {stats.no_consent ? <div className="flex justify-between"><dt className="text-fg-secondary">Excluded (no consent)</dt><dd className="tabular">{stats.no_consent}</dd></div> : null}
          </dl>
        </section>
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="msg-h">
          <h2 id="msg-h" className="mb-3 text-base font-semibold">Message</h2>
          {c.subject ? <p className="mb-2 font-medium">{c.subject}</p> : null}
          <p className="whitespace-pre-wrap text-sm">{c.body}</p>
        </section>
      </div>
    </>
  );
}
