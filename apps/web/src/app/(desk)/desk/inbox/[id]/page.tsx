import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Composer, MarkRead } from "@/components/messaging/composer";
import { ThreadControls } from "@/components/messaging/thread-controls";
import { ThreadView } from "@/components/messaging/thread-view";
import { replyToThread } from "@/server/actions/messaging";
import { requireSurfacePage } from "@/server/context";
import { getThread } from "@/server/queries/messaging";

export const metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("comms.send")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, members] = await Promise.all([
    getThread(ctx, id),
    ctx.supabase.from("tenant_users").select("user_id, roles(surface), profiles(full_name)").eq("status", "active"),
  ]);
  if (!data) notFound();
  const { thread, messages } = data;
  const staffList = (members.data ?? [])
    .filter((u) => u.roles?.surface === "desk" || u.roles?.surface === "mat")
    .map((u) => ({ id: u.user_id, name: u.profiles?.full_name ?? "Staff" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <MarkRead threadId={thread.id} />
      <PageHeader
        eyebrow={<Link href="/desk/inbox">Inbox</Link>}
        title={thread.subject || "Conversation"}
        description={<Link href={`/desk/households/${thread.households?.id}`}>{thread.households?.name}</Link>}
        actions={<ThreadControls threadId={thread.id} assignedUserId={thread.assigned_user_id} status={thread.status} staff={staffList} />}
      />
      <div className="mx-auto max-w-3xl space-y-6">
        <ThreadView messages={messages} perspective="staff" timeZone={ctx.tz} />
        <Composer threadId={thread.id} send={replyToThread} label="Send reply" />
      </div>
    </>
  );
}
