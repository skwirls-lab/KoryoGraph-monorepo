import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Composer, MarkRead } from "@/components/messaging/composer";
import { ThreadView } from "@/components/messaging/thread-view";
import { postToThread } from "@/server/actions/messaging";
import { requireSurfacePage } from "@/server/context";
import { getThread } from "@/server/queries/messaging";

export const metadata = { title: "Conversation" };

export default async function HomeThread({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("home");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getThread(ctx, id);
  if (!data) notFound();
  return (
    <>
      <MarkRead threadId={id} />
      <PageHeader eyebrow={<Link href="/home/messages">Messages</Link>} title={data.thread.subject || "Conversation"} />
      <div className="space-y-6">
        <ThreadView messages={data.messages} perspective="family" timeZone={ctx.tz} />
        <Composer threadId={id} send={postToThread} label="Send" />
      </div>
    </>
  );
}
