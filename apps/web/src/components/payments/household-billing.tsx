import "server-only";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Badge } from "@koryo/ui/components/ui/badge";
import type { Ctx } from "@/server/context";
import { NOT_CONFIGURED, NOT_CONNECTED, publishableKey, stripeClient, tenantStripe } from "@/server/payments/stripe";
import { listRecentPayments, listSavedCards } from "@/server/queries/payments";
import { AddCardButton } from "./card-setup";
import { ChargeCardButton } from "./charge-card";
import { SavedCards } from "./saved-cards";

/** Why card entry can't happen right now, or null when it can. Shown to users verbatim. */
export async function cardEntryBlocker(ctx: Ctx): Promise<string | null> {
  if (!stripeClient()) return NOT_CONFIGURED;
  const t = await tenantStripe(ctx);
  if (!t.accountId || !t.onboardingComplete) return NOT_CONNECTED;
  if (!publishableKey()) return "Card entry needs NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, which isn't set on this server.";
  return null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  succeeded: "secondary", pending: "outline", failed: "destructive", refunded: "outline", partially_refunded: "outline",
};

/** Desk household page: saved cards, add/charge, recent payments. */
export async function HouseholdBilling({ ctx, householdId }: { ctx: Ctx; householdId: string }) {
  const canCharge = ctx.permissions.has("billing.charge");
  const [cards, payments, blocker, { data: h }, { data: openInvoices }, { data: credits }] = await Promise.all([
    listSavedCards(ctx, householdId), listRecentPayments(ctx, householdId), cardEntryBlocker(ctx),
    ctx.supabase.from("households").select("balance_cents").eq("id", householdId).maybeSingle(),
    ctx.supabase.from("invoices").select("id, number, status, balance_cents, due_at").eq("household_id", householdId).in("status", ["open", "partially_paid", "past_due"]).order("due_at"),
    ctx.supabase.from("credits").select("id, remaining_cents, reason, expires_at").eq("household_id", householdId).gt("remaining_cents", 0).order("created_at", { ascending: false }),
  ]);
  const creditTotal = (credits ?? []).reduce((sum, c) => sum + c.remaining_cents, 0);
  return (
    <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="billing-h">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="billing-h" className="flex-1 text-base font-semibold">Billing</h2>
        {canCharge ? <AddCardButton householdId={householdId} disabledReason={blocker} /> : null}
        {canCharge && !blocker ? <ChargeCardButton householdId={householdId} cards={cards} /> : null}
      </div>
      {blocker && canCharge ? <p className="mb-3 rounded-md bg-elevated p-2 text-xs text-fg-secondary">{blocker}</p> : null}
      <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-elevated p-2"><dt className="text-xs text-fg-secondary">Balance</dt><dd className="tabular font-semibold">{formatMoney(h?.balance_cents ?? 0, ctx.currency)}</dd></div>
        <div className="rounded-lg bg-elevated p-2"><dt className="text-xs text-fg-secondary">Account credit</dt><dd className="tabular font-semibold">{formatMoney(creditTotal, ctx.currency)}</dd></div>
      </dl>
      {openInvoices?.length ? (
        <>
          <h3 className="mb-1 text-sm font-semibold">Open invoices</h3>
          <ul className="mb-3 divide-y divide-default text-sm" aria-label="Open invoices">
            {openInvoices.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-1.5">
                <a href={`/desk/billing/invoices/${i.id}`}>#{i.number}</a>
                <Badge variant={i.status === "past_due" ? "destructive" : "outline"}>{i.status.replace("_", " ")}</Badge>
                <span className="ml-auto tabular">{formatMoney(i.balance_cents, ctx.currency)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {credits?.length ? (
        <ul className="mb-3 space-y-1 text-xs text-fg-secondary" aria-label="Credits">
          {credits.map((c) => <li key={c.id}>{formatMoney(c.remaining_cents, ctx.currency)} · {c.reason}{c.expires_at ? ` · expires ${c.expires_at}` : ""}</li>)}
        </ul>
      ) : null}
      <h3 className="mb-1 text-sm font-semibold">Saved cards</h3>
      <SavedCards cards={cards} canManage={canCharge} canRemove={canCharge && !blocker} />
      <h3 className="mb-2 mt-4 text-sm font-semibold">Recent payments</h3>
      {payments.length ? (
        <ul className="divide-y divide-default text-sm" aria-label="Recent payments">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="tabular font-medium">{formatMoney(p.amount_cents, ctx.currency)}</span>
              <span className="capitalize text-fg-secondary">{p.method}</span>
              <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{p.status.replace("_", " ")}</Badge>
              <span className="ml-auto text-xs text-fg-muted">{new Date(p.received_at).toLocaleDateString("en-US", { timeZone: ctx.tz })}</span>
              {p.failure_message ? <span className="w-full text-xs text-danger">{p.failure_message}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">No payments yet.</p>
      )}
    </section>
  );
}
