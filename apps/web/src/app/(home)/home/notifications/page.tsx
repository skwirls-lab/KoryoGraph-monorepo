import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatDate } from "@koryo/ui/components/app/date-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { MarkRead, PushToggle } from "@/components/home/notifications";
import { HomePwa } from "@/components/home/pwa";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const ctx = await requireSurfacePage("home");
  const { data: items } = await ctx.supabase.from("communications").select("id, subject, body_text, created_at, read_at")
    .eq("channel", "inapp").eq("status", "sent").order("created_at", { ascending: false }).limit(50);
  const unread = (items ?? []).filter((i) => !i.read_at).length;
  return (
    <>
      <PageHeader title="Notifications" description={unread ? `${unread} new` : "You're all caught up."} actions={<HomePwa />} />
      <MarkRead unread={unread} />
      <div className="mb-4"><PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null} /></div>
      {!items?.length ? <EmptyState title="No notifications yet" description="Reminders and news from your school will show up here." /> : (
        <ul className="space-y-2" aria-label="Notifications">
          {items.map((n) => (
            <li key={n.id} className={`rounded-xl border bg-surface p-4 ${n.read_at ? "border-default" : "border-primary"}`}>
              <div className="flex items-baseline gap-2">
                {!n.read_at ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="New" role="img" /> : null}
                <h2 className="font-medium">{n.subject || "Message from your school"}</h2>
                <span className="ml-auto shrink-0 text-xs text-fg-muted">{formatDate(n.created_at, ctx.tz, "datetime")}</span>
              </div>
              {n.body_text ? <p className="mt-1 whitespace-pre-line text-sm text-fg-secondary">{n.body_text}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
