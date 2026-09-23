import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { AddCardButton } from "@/components/payments/card-setup";
import { cardEntryBlocker } from "@/components/payments/household-billing";
import { SavedCards } from "@/components/payments/saved-cards";
import { requireSurfacePage } from "@/server/context";
import { listSavedCards } from "@/server/queries/payments";

export const metadata = { title: "Billing" };

export default async function HomeBilling() {
  const ctx = await requireSurfacePage("home");
  if (!ctx.modules.has("billing")) {
    return (
      <>
        <PageHeader title="Billing" />
        <EmptyState title="Billing isn't online" description={`${ctx.tenantName ?? "Your school"} handles billing outside this app.`} />
      </>
    );
  }
  const { data: ids } = await ctx.supabase.rpc("my_household_ids");
  const { data: households } = await ctx.supabase.from("households").select("id, name").in("id", (ids as string[] | null) ?? []).order("name");
  const blocker = await cardEntryBlocker(ctx);
  const cards = await Promise.all((households ?? []).map(async (h) => ({ ...h, cards: await listSavedCards(ctx, h.id) })));
  return (
    <>
      <PageHeader title="Billing" description="Invoices, receipts and autopay settings are coming soon; you can save a card now." />
      <div className="space-y-4">
        {cards.map((h) => (
          <section key={h.id} className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby={`pm-${h.id}`}>
            <div className="mb-3 flex items-center gap-2">
              <h2 id={`pm-${h.id}`} className="flex-1 text-base font-semibold">Payment methods{cards.length > 1 ? ` · ${h.name}` : ""}</h2>
              <AddCardButton householdId={h.id} disabledReason={blocker} />
            </div>
            {blocker ? <p className="mb-3 text-xs text-fg-secondary">Online card payments aren&apos;t available yet. Your school can still take payment at the front desk.</p> : null}
            <SavedCards cards={h.cards} canManage canRemove={false} />
          </section>
        ))}
        {!cards.length ? <EmptyState title="No household yet" description="Ask the front desk to add you to your family's household." /> : null}
      </div>
    </>
  );
}
