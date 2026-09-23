import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { InvoiceActions, RefundButton } from "@/components/billing/invoice-actions";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status";
import { ModuleLocked } from "@/components/billing/module-locked";
import { cardEntryBlocker } from "@/components/payments/household-billing";
import { displayName, todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { listSavedCards } from "@/server/queries/payments";

export const metadata = { title: "Invoice" };

const ACTIVITY_LABEL: Record<string, string> = { payment: "Payment", reversal: "Reversed", credit_note: "Credit note", failed_payment: "Failed payment" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("billing.read")) forbidden();
  if (!ctx.modules.has("billing")) return <ModuleLocked title="Invoice" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: inv } = await ctx.supabase
    .from("invoices")
    .select("*, households(id, name), people(id, first_name, last_name, preferred_name), memberships(id, membership_plans(name)), invoice_lines(id, kind, description, quantity, unit_cents, total_cents, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();
  const [{ data: payments }, { data: activity }, { data: credits }, { data: comms }, cards, blocker] = await Promise.all([
    ctx.supabase.from("payments").select("id, amount_cents, refunded_cents, method, status, received_at, memo, failure_message, stripe_payment_intent_id").eq("invoice_id", id).order("received_at"),
    ctx.supabase.from("v_invoice_activity").select("*").eq("invoice_id", id).order("at"),
    ctx.supabase.from("credits").select("remaining_cents, expires_at").eq("household_id", inv.household_id).gt("remaining_cents", 0),
    ctx.supabase.from("communications").select("id, status, channel, created_at").eq("related_type", "invoice").eq("related_id", id).order("created_at", { ascending: false }).limit(5),
    listSavedCards(ctx, inv.household_id),
    cardEntryBlocker(ctx),
  ]);
  // Payments allocated here from elsewhere (e.g. a household-level card charge) also show via activity.
  const today = todayIn(ctx.tz);
  const creditAvailable = (credits ?? []).filter((c) => !c.expires_at || c.expires_at >= today).reduce((s, c) => s + c.remaining_cents, 0);
  const money = (c: number) => formatMoney(c, ctx.currency);
  const canCharge = ctx.permissions.has("billing.charge");
  const canRefund = ctx.permissions.has("billing.refund");
  const lines = [...(inv.invoice_lines ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/desk/billing/invoices">Invoices</Link>}
        title={`Invoice #${inv.number}`}
        description={<span className="inline-flex flex-wrap items-center gap-2"><InvoiceStatusBadge status={inv.status} /> <Link href={`/desk/households/${inv.household_id}`}>{inv.households?.name}</Link>{inv.people ? <> · <Link href={`/desk/people/${inv.people.id}?tab=billing`}>{displayName(inv.people)}</Link></> : null}</span>}
        actions={<InvoiceActions invoiceId={inv.id} status={inv.status} balanceCents={inv.balance_cents} paidCents={inv.paid_cents} cards={canCharge && !blocker ? cards : []} creditCents={creditAvailable} canCharge={canCharge} currency={ctx.currency} />}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5 lg:col-span-2" aria-labelledby="lines-h">
          <h2 id="lines-h" className="mb-3 text-base font-semibold">Lines</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-fg-secondary"><tr><th className="py-1">Description</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Unit</th><th className="py-1 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-default">
              {lines.map((l) => (
                <tr key={l.id}><td className="py-2">{l.description}{l.kind !== "membership" ? <span className="ml-2 text-xs text-fg-muted">{l.kind}</span> : null}</td><td className="py-2 text-right tabular">{l.quantity}</td><td className="py-2 text-right tabular">{money(l.unit_cents)}</td><td className="py-2 text-right tabular">{money(l.total_cents)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 ml-auto max-w-64 space-y-1 border-t border-default pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{money(inv.subtotal_cents)}</dd></div>
            {inv.discount_cents ? <div className="flex justify-between"><dt>Discounts</dt><dd className="tabular">−{money(inv.discount_cents)}</dd></div> : null}
            {inv.tax_cents ? <div className="flex justify-between"><dt>Tax</dt><dd className="tabular">{money(inv.tax_cents)}</dd></div> : null}
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular">{money(inv.total_cents)}</dd></div>
            <div className="flex justify-between"><dt>Paid</dt><dd className="tabular">{money(inv.paid_cents)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Balance</dt><dd className="tabular">{money(inv.balance_cents)}</dd></div>
          </dl>
        </section>
        <div className="space-y-4">
          <section className="rounded-xl border border-default bg-surface p-4 sm:p-5 text-sm" aria-labelledby="info-h">
            <h2 id="info-h" className="mb-2 text-base font-semibold">Details</h2>
            <dl className="space-y-1">
              <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Issued</dt><dd>{new Date(inv.issued_at).toLocaleDateString("en-US", { timeZone: ctx.tz })}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Due</dt><dd>{inv.due_at}</dd></div>
              {inv.period_start ? <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Period</dt><dd>{inv.period_start} → {inv.period_end ?? "—"}</dd></div> : null}
              {inv.memberships?.membership_plans ? <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Membership</dt><dd>{inv.memberships.membership_plans.name}</dd></div> : null}
              <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Source</dt><dd className="capitalize">{inv.source.replace("_", " ")}</dd></div>
              {inv.void_reason ? <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Void reason</dt><dd>{inv.void_reason}</dd></div> : null}
              {creditAvailable ? <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Household credit</dt><dd className="tabular">{money(creditAvailable)}</dd></div> : null}
            </dl>
          </section>
          <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="payments-h">
            <h2 id="payments-h" className="mb-2 text-base font-semibold">Payments</h2>
            {!payments?.length ? <p className="text-sm text-fg-muted">No payments yet.</p> : (
              <ul className="divide-y divide-default text-sm" aria-label="Payments">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="tabular font-medium">{money(p.amount_cents)}</span>
                    <span className="capitalize text-fg-secondary">{p.method}</span>
                    <Badge variant={p.status === "failed" ? "destructive" : p.status === "succeeded" ? "secondary" : "outline"}>{p.status.replace("_", " ")}</Badge>
                    {p.refunded_cents ? <span className="text-xs text-fg-muted">refunded {money(p.refunded_cents)}</span> : null}
                    {canRefund && ["succeeded", "partially_refunded"].includes(p.status) ? <span className="ml-auto"><RefundButton paymentId={p.id} maxCents={p.amount_cents - p.refunded_cents} method={p.method} currency={ctx.currency} /></span> : null}
                    {p.failure_message ? <span className="w-full text-xs text-danger">{p.failure_message}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <section className="mt-4 rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="timeline-h">
        <h2 id="timeline-h" className="mb-3 text-base font-semibold">Timeline</h2>
        <ol className="space-y-2 text-sm" aria-label="Timeline">
          <li className="flex gap-2"><span className="w-40 shrink-0 text-fg-muted">{new Date(inv.issued_at).toLocaleString("en-US", { timeZone: ctx.tz })}</span><span>Issued for {money(inv.total_cents)}</span></li>
          {(activity ?? []).map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-40 shrink-0 text-fg-muted">{new Date(a.at ?? "").toLocaleString("en-US", { timeZone: ctx.tz })}</span>
              <span>
                {ACTIVITY_LABEL[a.kind ?? ""] ?? a.kind}{a.credit_note_number ? ` CN-${a.credit_note_number}` : ""}: <span className="tabular">{money(Math.abs(a.amount_cents ?? 0))}</span>
                {a.method ? <span className="text-fg-secondary"> · {a.method}</span> : null}{a.note ? <span className="text-fg-secondary"> · {a.note}</span> : null}
              </span>
            </li>
          ))}
          {(comms ?? []).map((c) => (
            <li key={c.id} className="flex gap-2"><span className="w-40 shrink-0 text-fg-muted">{new Date(c.created_at).toLocaleString("en-US", { timeZone: ctx.tz })}</span><span>Receipt {c.channel}: {c.status === "unsent_no_provider" ? "not sent — no email provider configured (in the Outbox)" : c.status.replace(/_/g, " ")}</span></li>
          ))}
          {inv.voided_at ? <li className="flex gap-2"><span className="w-40 shrink-0 text-fg-muted">{new Date(inv.voided_at).toLocaleString("en-US", { timeZone: ctx.tz })}</span><span>Voided: {inv.void_reason}</span></li> : null}
        </ol>
      </section>
    </>
  );
}
