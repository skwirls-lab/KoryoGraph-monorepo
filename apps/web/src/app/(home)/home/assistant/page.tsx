import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { HomeAssistantChat } from "@/components/copilot/home-assistant-chat";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Ask" };

export default async function HomeAssistantPage() {
  const ctx = await requireSurfacePage("home");
  if (!ctx.modules.has("intelligence")) return <><PageHeader title="Ask" /><EmptyState title="Not available" description="Your school hasn't turned on the app assistant. Message the front desk instead." /></>;
  const { data: conv } = await ctx.supabase.from("ai_conversations").select("id").eq("surface", "home").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const { data: rows } = conv ? await ctx.supabase.from("ai_messages").select("role, content, citations, fixture").eq("conversation_id", conv.id).order("created_at").limit(40) : { data: [] };
  return (
    <>
      <PageHeader title="Ask" description="Answers from your school's policies and your own family's account. It can't see other families." />
      <HomeAssistantChat conversationId={conv?.id ?? null} initial={(rows ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content, sources: (m.citations ?? []) as unknown as { id: string; title: string }[], escalate: false, fixture: m.fixture }))} />
    </>
  );
}
