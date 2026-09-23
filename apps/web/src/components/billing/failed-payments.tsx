import "server-only";
import Link from "next/link";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Badge } from "@koryo/ui/components/ui/badge";
import { cardEntryBlocker } from "@/components/payments/household-billing";
import type { Ctx } from "@/server/context";
import { RetryPaymentButton } from "./retry-payment";

/** Desk widget: invoices in dunning, with the step reached and what happens next. */
export async function FailedPayments({ ctx, limit = 10 }: { ctx: Ctx; limit?: number }) {
  if (!ctx.modules.has("billing") || !ctx.permissions.has("billing.read")) return null;
  const [{ data: rows, count }, blocker] = await Promise.all([
    ctx.supabase.from("v_dunning").select("*", { count: "exact" }).order("failed_on").limit(limit),
    cardEntryBlocker(ctx),
  ]);
  const canRetry = ctx.permissions.has("billing.charge") && !blocker;
  return (
    <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="failed-h">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="failed-h" className="flex-1 text-base font-semibold">Failed payments</h2>
        {count ? <Badge variant="destructive">{count}</Badge> : null}
      </div>
      {!rows?.length ? <p className="text-sm text-fg-muted">No failed payments. Nice.</p> : (
        <ul className="divide-y divide-default text-sm" aria-label="Failed payments">
          {rows.map((r) => (
            <li key={r.invoice_id} aria-label={`${r.household_name} invoice ${r.number}`} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={`/desk/billing/invoices/${r.invoice_id}`} className="font-medium">{r.household_name}</Link>
              <span className="tabular">{formatMoney(r.balance_cents ?? 0, ctx.currency)}</span>
              <Badge variant="outline">step {r.stage}</Badge>
              {r.membership_status === "suspended" ? <Badge variant="destructive">suspended</Badge> : null}
              <span className="text-xs text-fg-muted">since {r.failed_on}{r.next_step_on ? ` · next step ${r.next_step_on}` : " · final step done"}</span>
              {canRetry && r.invoice_id ? <span className="ml-auto"><RetryPaymentButton invoiceId={r.invoice_id} /></span> : null}
              {r.last_error ? <span className="w-full text-xs text-danger">{r.last_error}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {count && count > limit ? <p className="mt-2 text-sm"><Link href="/desk/billing/failed">View all {count}</Link></p> : null}
      {blocker && rows?.length ? <p className="mt-2 text-xs text-fg-muted">Card retries need Stripe. {blocker}</p> : null}
    </section>
  );
}
