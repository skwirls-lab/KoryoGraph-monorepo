import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ActionBoard } from "@/components/mat/action-board";
import { boardPayloadSchema } from "@/server/action-board";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Action board" };

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("mat");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: s } = await ctx.supabase.from("class_sessions").select("id, name").eq("id", id).maybeSingle();
  if (!s) notFound();
  const { data: item } = await ctx.supabase.from("approval_items").select("id, payload, status, feedback, execution_result, decided_at, ai_transport").eq("kind", "action_board").eq("entity_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const payload = item ? boardPayloadSchema.safeParse(item.payload) : null;
  const result = item?.execution_result as { ok?: boolean; summary?: string; error?: string } | null;
  if (item && item.status !== "pending") {
    return (
      <>
        <PageHeader eyebrow={<Link href={`/mat/session/${id}`}>{s.name}</Link>} title="Action board" />
        <p role="status" className={`rounded-xl border p-4 ${item.status === "approved" && result?.ok ? "border-success/40 bg-success/10" : "border-default bg-surface"}`}>
          {item.status === "approved" ? (result?.ok ? `Saved: ${result.summary}.` : `Approved, but it couldn't be saved: ${result?.error ?? "unknown error"}.`) : `Discarded${item.feedback ? ` — “${item.feedback}”` : ""}.`}
        </p>
      </>
    );
  }
  return (
    <>
      <PageHeader eyebrow={<Link href={`/mat/session/${id}`}>{s.name}</Link>} title="Action board" description="Tick what's right. Uncertain rows start unticked. Approving writes attendance, sign-offs, notes and tasks." />
      {!item || !payload?.success ? <EmptyState title="No board waiting" description="Record the class or type notes on the class page to get one." />
        : ctx.permissions.has("ai.approve") ? <ActionBoard approvalId={item.id} initial={payload.data} fixture={item.ai_transport === "fixture"} />
          : <p className="text-sm text-fg-muted">A board is waiting; approving it needs the ai.approve permission.</p>}
    </>
  );
}
