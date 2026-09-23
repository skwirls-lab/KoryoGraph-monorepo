import type { Citation } from "@koryo/ai";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { CopilotChat, type ChatMessage } from "@/components/copilot/copilot-chat";
import { aiFor } from "@/server/ai";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Copilot" };

export default async function CopilotPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("ai.use")) forbidden();
  if (!ctx.modules.has("intelligence")) {
    return <><PageHeader title="Copilot" /><p className="rounded-xl border border-dashed border-default p-6 text-sm text-fg-secondary">The copilot is part of the Intelligence module, which isn&apos;t on this school&apos;s plan.</p></>;
  }
  const { c, q } = await searchParams;
  const conversationId = c && /^[0-9a-f-]{36}$/i.test(c) ? c : null;
  const [{ data: conversations }, { data: rows }] = await Promise.all([
    ctx.supabase.from("ai_conversations").select("id, title, updated_at").eq("surface", "desk").order("updated_at", { ascending: false }).limit(30),
    conversationId ? ctx.supabase.from("ai_messages").select("id, role, content, citations, steps, fixture, status").eq("conversation_id", conversationId).order("created_at") : Promise.resolve({ data: [] }),
  ]);
  const messages: ChatMessage[] = (rows ?? []).map((m) => ({
    id: m.id, role: m.role as "user" | "assistant", content: m.content, citations: (m.citations ?? []) as unknown as Citation[],
    steps: (m.steps ?? []) as unknown as ChatMessage["steps"], fixture: m.fixture, error: m.status === "error",
  }));
  const mode = aiFor(ctx).status();
  return (
    <>
      <PageHeader title="Copilot" description={mode.transport === "live" ? "Answers from your school's data and policies, with sources. It can draft messages for approval; it never sends or changes anything." : "No OpenRouter key on this server: the copilot replays recorded dev examples only (marked “dev fixture”)."}
        actions={<Button asChild size="sm" variant="outline"><Link href="/desk/copilot">New conversation</Link></Button>} />
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Conversations" className="rounded-xl border border-default bg-surface p-2">
          {!conversations?.length ? <p className="p-2 text-sm text-fg-muted">No conversations yet.</p> : (
            <ul className="space-y-0.5 text-sm">
              {conversations.map((cv) => (
                <li key={cv.id}><Link href={`/desk/copilot?c=${cv.id}`} aria-current={cv.id === conversationId ? "page" : undefined}
                  className={`block truncate rounded-md px-2 py-1.5 no-underline ${cv.id === conversationId ? "bg-elevated font-medium text-fg" : "text-fg-secondary hover:bg-elevated"}`}>{cv.title}</Link></li>
              ))}
            </ul>
          )}
        </nav>
        <CopilotChat key={conversationId ?? "new"} conversationId={conversationId} messages={messages} initialQuestion={!conversationId && q ? q.slice(0, 500) : undefined} />
      </div>
    </>
  );
}
