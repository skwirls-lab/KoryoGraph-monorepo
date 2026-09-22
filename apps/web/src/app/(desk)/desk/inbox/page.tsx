import Link from "next/link";
import { forbidden } from "next/navigation";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { cn } from "@koryo/ui/lib/utils";
import { requireSurfacePage } from "@/server/context";
import { listThreads } from "@/server/queries/messaging";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("comms.send")) forbidden();
  const { view = "open" } = await searchParams;
  const threads = await listThreads(ctx, { status: view === "closed" ? "closed" : "open", mine: view === "mine" });
  const tabs = [["open", "Open"], ["mine", "Assigned to me"], ["closed", "Closed"]] as const;
  return (
    <>
      <PageHeader
        title="Inbox"
        description="Conversations with families."
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/desk/outbox">Outbox</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/desk/inbox/approvals">Approvals</Link></Button>
          </>
        }
      />
      <nav aria-label="Inbox views" className="mb-4 flex gap-2">
        {tabs.map(([k, label]) => (
          <Button key={k} asChild size="sm" variant={view === k ? "secondary" : "ghost"}><Link href={`/desk/inbox?view=${k}`} aria-current={view === k ? "page" : undefined}>{label}</Link></Button>
        ))}
      </nav>
      {threads.length === 0 ? <EmptyState title="No conversations" description="Messages families send from the Home app appear here." /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Conversations">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/desk/inbox/${t.id}`} className="flex items-center gap-3 px-4 py-3 text-fg no-underline hover:bg-elevated" aria-label={`${t.households?.name}: ${t.subject}${t.unread_staff ? `, ${t.unread_staff} unread` : ""}`}>
                <span className={cn("size-2 shrink-0 rounded-full", t.unread_staff ? "bg-brand" : "bg-transparent")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate", t.unread_staff ? "font-semibold" : "")}>{t.households?.name} — {t.subject || "(no subject)"}</span>
                </span>
                <DateText value={t.last_message_at} timeZone={ctx.tz} style="short" className="shrink-0 text-xs text-fg-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
