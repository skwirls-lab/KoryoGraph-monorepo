import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { BroadcastForm } from "@/components/automations/broadcast-form";
import { ModuleLocked } from "@/components/billing/module-locked";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Broadcasts" };

export default async function BroadcastsPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("comms.send")) forbidden();
  if (!ctx.modules.has("grow")) return <ModuleLocked title="Broadcasts" module="Grow" />;
  const [{ data: programs }, { data: sent }] = await Promise.all([
    ctx.supabase.from("programs").select("id, name").eq("active", true).order("sort"),
    ctx.supabase.from("campaigns").select("id, name, channel, sent_at, stats").order("created_at", { ascending: false }).limit(30),
  ]);
  return (
    <>
      <PageHeader title="Broadcasts" description="Email or text a segment of students' families." />
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-label="New broadcast"><BroadcastForm programs={programs ?? []} /></section>
        <section className="h-fit rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="sent-h">
          <h2 id="sent-h" className="mb-3 text-base font-semibold">Sent</h2>
          {!sent?.length ? <p className="text-sm text-fg-muted">Nothing sent yet.</p> : (
            <ul className="divide-y divide-default text-sm" aria-label="Sent broadcasts">
              {sent.map((c) => <li key={c.id} className="py-2"><Link href={`/desk/broadcasts/${c.id}`} className="font-medium">{c.name}</Link><div className="text-xs text-fg-muted">{c.channel} · {c.sent_at ? new Date(c.sent_at).toLocaleString("en-US", { timeZone: ctx.tz }) : "draft"} · {(c.stats as { queued?: number }).queued ?? 0} messages</div></li>)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
