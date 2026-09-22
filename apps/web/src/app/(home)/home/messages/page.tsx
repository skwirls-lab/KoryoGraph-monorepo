import Link from "next/link";
import { DateText } from "@koryo/ui/components/app/date-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { cn } from "@koryo/ui/lib/utils";
import { NewThreadForm } from "@/components/messaging/new-thread-form";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Messages" };

export default async function HomeMessages() {
  const ctx = await requireSurfacePage("home");
  const { data: threads } = await ctx.supabase.from("message_threads").select("id, subject, last_message_at, unread_household").order("last_message_at", { ascending: false });
  return (
    <>
      <PageHeader title="Messages" description="Conversations with your school." />
      <div className="space-y-6">
        {threads?.length ? (
          <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Conversations">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/home/messages/${t.id}`} className="flex min-h-14 items-center gap-3 px-4 text-fg no-underline hover:bg-elevated" aria-label={`${t.subject}${t.unread_household ? `, ${t.unread_household} new` : ""}`}>
                  <span aria-hidden className={cn("size-2 rounded-full", t.unread_household ? "bg-brand" : "bg-transparent")} />
                  <span className={cn("min-w-0 flex-1 truncate", t.unread_household && "font-semibold")}>{t.subject || "Conversation"}</span>
                  <DateText value={t.last_message_at} timeZone={ctx.tz} style="short" className="text-xs text-fg-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-fg-secondary">No conversations yet.</p>}
        <NewThreadForm />
      </div>
    </>
  );
}
