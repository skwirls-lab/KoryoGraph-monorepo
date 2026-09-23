import "server-only";
import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { todayIn } from "@/lib/people";
import type { Ctx } from "@/server/context";
import { MembershipActions } from "./membership-actions";

/** Person → Billing tab: memberships and their invoices. */
export async function PersonBilling({ ctx, personId }: { ctx: Ctx; personId: string }) {
  if (!ctx.modules.has("billing")) return <EmptyState title="Billing isn't on your plan" description="Memberships and invoices are part of the Billing module." />;
  if (!ctx.permissions.has("billing.read")) return <EmptyState title="No access" description="You don't have permission to view billing." />;
  const [{ data: memberships }, { data: invoices }] = await Promise.all([
    ctx.supabase.from("memberships").select("id, status, starts_at, ends_at, next_bill_at, contract_ends_at, autopay, price_override_cents, hold_from, hold_until, cancel_at, membership_plans(name, kind, price_cents, interval)").eq("person_id", personId).order("created_at", { ascending: false }),
    ctx.supabase.from("invoices").select("id, number, status, issued_at, total_cents, balance_cents").eq("person_id", personId).order("issued_at", { ascending: false }).limit(10),
  ]);
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="memberships-h">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="memberships-h" className="flex-1 text-base font-semibold">Memberships</h2>
          {ctx.permissions.has("billing.charge") ? <Button asChild size="sm"><Link href={`/desk/people/${personId}/enroll`} className="no-underline">Enroll in membership</Link></Button> : null}
        </div>
        {!memberships?.length ? <p className="text-sm text-fg-muted">No memberships yet.</p> : (
          <ul className="divide-y divide-default" aria-label="Memberships">
            {memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium">{m.membership_plans?.name}</span>
                <Badge variant={m.status === "active" ? "secondary" : "outline"}>{m.status.replace("_", " ")}</Badge>
                <span className="tabular text-fg-secondary">{formatMoney(m.price_override_cents ?? m.membership_plans?.price_cents ?? 0, ctx.currency)}{m.membership_plans?.interval ? `/${m.membership_plans.interval}` : ""}</span>
                <span className="text-xs text-fg-muted">
                  since {m.starts_at}{m.next_bill_at ? ` · next bill ${m.next_bill_at}` : ""}{m.ends_at ? ` · ends ${m.ends_at}` : ""}{m.contract_ends_at ? ` · contract to ${m.contract_ends_at}` : ""}{m.autopay ? " · autopay" : ""}
                  {m.hold_from ? ` · hold ${m.hold_from} → ${m.hold_until ?? "?"}` : ""}{m.cancel_at ? ` · cancels ${m.cancel_at}` : ""}
                </span>
                {ctx.permissions.has("billing.charge") ? <span className="ml-auto"><MembershipActions membershipId={m.id} status={m.status} planName={m.membership_plans?.name ?? "membership"} today={todayIn(ctx.tz)} holdFrom={m.hold_from} /></span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="invoices-h">
        <h2 id="invoices-h" className="mb-3 text-base font-semibold">Invoices</h2>
        {!invoices?.length ? <p className="text-sm text-fg-muted">No invoices yet.</p> : (
          <ul className="divide-y divide-default" aria-label="Invoices">
            {invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium">#{i.number}</span>
                <Badge variant={i.status === "paid" ? "secondary" : i.status === "past_due" ? "destructive" : "outline"}>{i.status.replace("_", " ")}</Badge>
                <span className="tabular">{formatMoney(i.total_cents, ctx.currency)}</span>
                {i.balance_cents > 0 && i.status !== "void" ? <span className="tabular text-fg-secondary">balance {formatMoney(i.balance_cents, ctx.currency)}</span> : null}
                <span className="ml-auto text-xs text-fg-muted">{new Date(i.issued_at).toLocaleDateString("en-US", { timeZone: ctx.tz })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
