import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { ApprovalQueue, type QueueItem } from "@/components/approvals/approval-queue";
import { APPROVAL_KINDS, type ApprovalKind } from "@/lib/approvals";
import { displayName } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("ai.use")) forbidden();
  if (!ctx.modules.has("intelligence")) {
    return (
      <>
        <PageHeader title="Approvals" />
        <p className="rounded-xl border border-dashed border-default p-6 text-sm text-fg-secondary">The approval queue is part of the Intelligence module, which isn&apos;t on this school&apos;s plan. Nothing is drafted or sent by AI.</p>
      </>
    );
  }
  const { kind: k } = await searchParams;
  const kind = k && k in APPROVAL_KINDS ? (k as ApprovalKind) : null;
  let pendingQ = ctx.supabase.from("approval_items").select("id, kind, title, preview, payload, created_at, person_id, people(first_name, last_name, preferred_name), ai_runs(transport)").eq("status", "pending");
  if (kind) pendingQ = pendingQ.eq("kind", kind);
  // Counts come from every pending item (not just the page shown), so a big batch of one kind can't hide the others.
  const [{ data: pending }, { data: decided }, { data: allKinds }] = await Promise.all([
    pendingQ.order("created_at").limit(200),
    ctx.supabase.from("approval_items").select("id, kind, title, status, feedback, decided_at, execution_result").neq("status", "pending").order("decided_at", { ascending: false }).limit(10),
    ctx.supabase.from("approval_items").select("kind").eq("status", "pending").limit(10000),
  ]);
  const counts = new Map<string, number>();
  for (const p of allKinds ?? []) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  const total = allKinds?.length ?? 0;
  const items: QueueItem[] = (pending ?? []).map((p) => ({
    id: p.id, kind: p.kind as ApprovalKind, title: p.title, preview: p.preview, payload: p.payload, createdAt: p.created_at,
    personId: p.person_id, personName: p.people ? displayName(p.people) : null, fixture: p.ai_runs?.transport === "fixture",
  }));
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/inbox">Inbox</Link>} title="Approvals" description="Drafts from KoryoGraph's AI agents. Nothing reaches a family, or changes records, until someone approves it here." />
      <nav aria-label="Filter by kind" className="mb-4 flex flex-wrap gap-1">
        <Button asChild size="sm" variant={!kind ? "secondary" : "ghost"}><Link href="/desk/inbox/approvals" aria-current={!kind ? "page" : undefined}>All ({total})</Link></Button>
        {[...counts.entries()].map(([kk, n]) => (
          <Button key={kk} asChild size="sm" variant={kind === kk ? "secondary" : "ghost"}><Link href={`/desk/inbox/approvals?kind=${kk}`} aria-current={kind === kk ? "page" : undefined}>{APPROVAL_KINDS[kk as ApprovalKind] ?? kk} ({n})</Link></Button>
        ))}
      </nav>
      {items.length < (kind ? counts.get(kind) ?? 0 : total) ? <p className="mb-2 text-sm text-fg-muted">Showing the oldest {items.length} of {kind ? counts.get(kind) : total}; approve or reject these to see the rest.</p> : null}
      <ApprovalQueue items={items} canApprove={ctx.permissions.has("ai.approve")} />
      {decided?.length ? (
        <section aria-labelledby="decided-h" className="mt-8 rounded-xl border border-default bg-surface p-4">
          <h2 id="decided-h" className="mb-2 text-base font-semibold">Recently decided</h2>
          <ul className="divide-y divide-default text-sm" aria-label="Recently decided">
            {decided.map((d) => {
              const res = d.execution_result as { ok?: boolean; summary?: string; error?: string } | null;
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <Badge variant={d.status === "approved" ? "secondary" : "outline"}>{d.status}</Badge>
                  <span>{d.title}</span>
                  <span className="text-xs text-fg-muted">{d.status === "rejected" ? `“${d.feedback}”` : res ? (res.ok ? res.summary : `not carried out: ${res.error}`) : ""}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
