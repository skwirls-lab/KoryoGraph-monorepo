import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { AutopaySwitch, HoldRequestDialog, PayInvoiceButton } from "@/components/billing/home-wallet";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status";
import { AddCardButton } from "@/components/payments/card-setup";
import { cardEntryBlocker } from "@/components/payments/household-billing";
import { SavedCards } from "@/components/payments/saved-cards";
import { cardLabel } from "@/lib/payments";
import { displayName, todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { listSavedCards } from "@/server/queries/payments";

export const metadata = { title: "Billing" };

const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";

export default async function HomeBilling({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const ctx = await requireSurfacePage("home");
  if (!ctx.modules.has("billing")) {
    return (
      <>
        <PageHeader title="Billing" />
        <EmptyState title="Billing isn't online" description={`${ctx.tenantName ?? "Your school"} handles billing outside this app.`} />
      </>
    );
  }
  const { invoice: focus } = await searchParams;
  const { data: ids } = await ctx.supabase.rpc("my_household_ids");
  const householdIds = (ids as string[] | null) ?? [];
  const [{ data: households }, { data: invoices }, { data: memberships }, { data: payments }, { data: credits }, blocker] = await Promise.all([
    ctx.supabase.from("households").select("id, name, balance_cents").in("id", householdIds).order("name"),
    ctx.supabase.from("invoices").select("id, number, status, issued_at, due_at, total_cents, balance_cents, household_id").in("household_id", householdIds).neq("status", "draft").order("issued_at", { ascending: false }).limit(50),
    ctx.supabase.from("memberships").select("id, status, next_bill_at, autopay, payment_method_id, price_override_cents, hold_from, hold_until, household_id, people(first_name, last_name, preferred_name), membership_plans(name, kind, price_cents, interval)").in("household_id", householdIds).in("status", ["active", "trial", "past_due", "on_hold", "suspended"]),
    ctx.supabase.from("payments").select("id, amount_cents, refunded_cents, method, status, received_at, invoice_id").in("household_id", householdIds).in("status", ["succeeded", "partially_refunded", "refunded"]).order("received_at", { ascending: false }).limit(20),
    ctx.supabase.from("credits").select("remaining_cents").in("household_id", householdIds).gt("remaining_cents", 0),
    cardEntryBlocker(ctx),
  ]);
  if (!households?.length) {
    return <><PageHeader title="Billing" /><EmptyState title="No household yet" description="Ask the front desk to add you to your family's household." /></>;
  }
  const cardsBy = new Map(await Promise.all(households.map(async (h) => [h.id, await listSavedCards(ctx, h.id)] as const)));
  const money = (c: number) => formatMoney(c, ctx.currency);
  const due = (invoices ?? []).filter((i) => ["open", "partially_paid", "past_due"].includes(i.status) && i.balance_cents > 0);
  const history = (invoices ?? []).filter((i) => !due.includes(i));
  const balance = households.reduce((s, h) => s + h.balance_cents, 0);
  const creditTotal = (credits ?? []).reduce((s, c) => s + c.remaining_cents, 0);
  const today = todayIn(ctx.tz);
  const numberOf = new Map((invoices ?? []).map((i) => [i.id, i.number]));

  return (
    <>
      <PageHeader title="Billing" description={ctx.tenantName ?? undefined} />
      <div className="space-y-4">
        <section className={card} aria-labelledby="balance-h">
          <h2 id="balance-h" className="sr-only">Balance</h2>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-sm text-fg-secondary">Balance due</dt><dd className="font-display text-3xl font-bold tabular">{money(Math.max(balance, 0))}</dd></div>
            <div><dt className="text-sm text-fg-secondary">Account credit</dt><dd className="font-display text-3xl font-bold tabular">{money(creditTotal)}</dd></div>
          </dl>
        </section>

        <section className={card} aria-labelledby="due-h">
          <h2 id="due-h" className="mb-3 text-base font-semibold">To pay</h2>
          {!due.length ? <p className="text-sm text-fg-muted">You&apos;re all paid up.</p> : (
            <ul className="divide-y divide-default" aria-label="Invoices to pay">
              {due.map((i) => (
                <li key={i.id} aria-label={`Invoice ${i.number}`} className={`flex flex-wrap items-center gap-2 py-3 ${focus === i.id ? "rounded-md bg-primary/5 px-2" : ""}`}>
                  <span className="font-medium">#{i.number}</span>
                  <InvoiceStatusBadge status={i.status} />
                  <span className="text-xs text-fg-muted">due {i.due_at}</span>
                  <span className="ml-auto tabular font-semibold">{money(i.balance_cents)}</span>
                  {!blocker ? <PayInvoiceButton invoiceId={i.id} number={i.number} currency={ctx.currency} /> : null}
                </li>
              ))}
            </ul>
          )}
          {due.length && blocker ? <p className="mt-2 text-xs text-fg-secondary">Online card payments aren&apos;t available yet — you can pay at the front desk.</p> : null}
        </section>

        {memberships?.length ? (
          <section className={card} aria-labelledby="memberships-h">
            <h2 id="memberships-h" className="mb-3 text-base font-semibold">Memberships</h2>
            <ul className="divide-y divide-default" aria-label="Memberships">
              {memberships.map((m) => {
                const cards = cardsBy.get(m.household_id) ?? [];
                const payCard = cards.find((c) => c.id === m.payment_method_id);
                const recurring = m.membership_plans?.kind === "recurring" || m.membership_plans?.kind === "contract";
                return (
                  <li key={m.id} aria-label={`${m.membership_plans?.name} for ${m.people ? displayName(m.people) : ""}`} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.membership_plans?.name}</span>
                      <span className="text-sm text-fg-secondary">{m.people ? displayName(m.people) : ""}</span>
                      <Badge variant={m.status === "active" ? "secondary" : m.status === "suspended" || m.status === "past_due" ? "destructive" : "outline"}>{m.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-sm text-fg-secondary">
                      {money(m.price_override_cents ?? m.membership_plans?.price_cents ?? 0)}{m.membership_plans?.interval ? `/${m.membership_plans.interval}` : ""}
                      {m.next_bill_at && recurring ? ` · next bill ${m.next_bill_at}` : ""}
                      {m.hold_from ? ` · on hold ${m.hold_from} → ${m.hold_until ?? "?"}` : ""}
                      {m.status === "suspended" ? " · paused until the balance is paid" : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      {recurring ? <AutopaySwitch membershipId={m.id} enabled={m.autopay} planName={m.membership_plans?.name ?? "membership"} disabled={!cards.length} /> : null}
                      {recurring && m.autopay && payCard ? <span className="text-xs text-fg-muted">{cardLabel(payCard)}</span> : null}
                      {recurring && !cards.length ? <span className="text-xs text-fg-muted">Add a card to use autopay.</span> : null}
                      {["active", "past_due"].includes(m.status) ? <HoldRequestDialog membershipId={m.id} planName={m.membership_plans?.name ?? "the membership"} today={today} /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {households.map((h) => (
          <section key={h.id} className={card} aria-labelledby={`pm-${h.id}`}>
            <div className="mb-3 flex items-center gap-2">
              <h2 id={`pm-${h.id}`} className="flex-1 text-base font-semibold">Payment methods{households.length > 1 ? ` · ${h.name}` : ""}</h2>
              <AddCardButton householdId={h.id} disabledReason={blocker} />
            </div>
            {blocker ? <p className="mb-3 text-xs text-fg-secondary">Online card payments aren&apos;t available yet. Your school can still take payment at the front desk.</p> : null}
            <SavedCards cards={cardsBy.get(h.id) ?? []} canManage canRemove={!blocker} as="home" />
          </section>
        ))}

        <section className={card} aria-labelledby="history-h">
          <h2 id="history-h" className="mb-3 text-base font-semibold">History</h2>
          {!payments?.length && !history.length ? <p className="text-sm text-fg-muted">No payments yet.</p> : null}
          {payments?.length ? (
            <ul className="divide-y divide-default text-sm" aria-label="Payments">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="tabular font-medium">{money(p.amount_cents)}</span>
                  <span className="capitalize text-fg-secondary">{p.method}</span>
                  {p.refunded_cents ? <span className="text-xs text-fg-muted">refunded {money(p.refunded_cents)}</span> : null}
                  <span className="text-xs text-fg-muted">{new Date(p.received_at).toLocaleDateString("en-US", { timeZone: ctx.tz })}{p.invoice_id && numberOf.get(p.invoice_id) ? ` · invoice #${numberOf.get(p.invoice_id)}` : ""}</span>
                  <Link href={`/home/billing/receipts/${p.id}`} className="ml-auto">Receipt</Link>
                </li>
              ))}
            </ul>
          ) : null}
          {history.length ? (
            <ul className="mt-3 divide-y divide-default text-sm" aria-label="Past invoices">
              {history.slice(0, 20).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span>#{i.number}</span>
                  <InvoiceStatusBadge status={i.status} />
                  <span className="ml-auto tabular">{money(i.total_cents)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  );
}
