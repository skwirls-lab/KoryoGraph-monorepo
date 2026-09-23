import { addDaysStr } from "@koryo/billing";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { StatCard } from "@koryo/ui/components/app/stat-card";
import { Badge } from "@koryo/ui/components/ui/badge";
import { ModuleLocked } from "@/components/billing/module-locked";
import { todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Billing" };

const BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
const BUCKET_LABEL: Record<(typeof BUCKETS)[number], string> = { current: "Not yet due", "1-30": "1–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "90+": "Over 90 days" };

export default async function BillingDashboard() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("billing.read")) forbidden();
  if (!ctx.modules.has("billing")) return <ModuleLocked title="Billing" />;
  const since = addDaysStr(todayIn(ctx.tz), -30);
  const [{ data: aging }, { data: mrr }, { data: collected }, { data: runs }] = await Promise.all([
    ctx.supabase.from("v_ar_aging").select("invoice_id, household_id, household_name, balance_cents, bucket, days_overdue"),
    ctx.supabase.from("v_mrr").select("mrr_cents"),
    ctx.supabase.from("payments").select("amount_cents, refunded_cents").in("status", ["succeeded", "partially_refunded", "refunded"]).neq("method", "credit").gte("received_at", since),
    ctx.supabase.from("billing_runs").select("id, run_date, status, invoices_created, amount_cents, charges_attempted, errors").order("created_at", { ascending: false }).limit(5),
  ]);
  const rows = aging ?? [];
  const open = rows.reduce((s, r) => s + (r.balance_cents ?? 0), 0);
  const pastDue = rows.filter((r) => r.bucket !== "current").reduce((s, r) => s + (r.balance_cents ?? 0), 0);
  const mrrTotal = (mrr ?? []).reduce((s, r) => s + (r.mrr_cents ?? 0), 0);
  const cash = (collected ?? []).reduce((s, p) => s + p.amount_cents - p.refunded_cents, 0);
  const buckets = BUCKETS.map((b) => ({ b, cents: rows.filter((r) => r.bucket === b).reduce((s, r) => s + (r.balance_cents ?? 0), 0), count: rows.filter((r) => r.bucket === b).length }));
  const max = Math.max(1, ...buckets.map((x) => x.cents));
  const owing = new Map<string, { name: string; cents: number; days: number }>();
  for (const r of rows) {
    if (r.bucket === "current" || !r.household_id) continue;
    const cur = owing.get(r.household_id) ?? { name: r.household_name ?? "", cents: 0, days: 0 };
    cur.cents += r.balance_cents ?? 0;
    cur.days = Math.max(cur.days, r.days_overdue ?? 0);
    owing.set(r.household_id, cur);
  }
  const topOwing = [...owing.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 8);
  const money = (c: number) => formatMoney(c, ctx.currency);

  return (
    <>
      <PageHeader title="Billing" description={`Accounts receivable as of ${todayIn(ctx.tz)}`} actions={
        <div className="flex gap-2">
          <Link href="/desk/billing/invoices" className="text-sm">Invoices</Link>
          <Link href="/desk/billing/plans" className="text-sm">Plans</Link>
        </div>
      } />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open receivables" value={money(open)} hint={`${rows.length} unpaid invoice${rows.length === 1 ? "" : "s"}`} href="/desk/billing/invoices?status=unpaid" />
        <StatCard label="Past due" value={money(pastDue)} tone={pastDue ? "negative" : "neutral"} delta={pastDue ? `${owing.size} household${owing.size === 1 ? "" : "s"}` : undefined} href="/desk/billing/invoices?status=past_due" />
        <StatCard label="Collected, last 30 days" value={money(cash)} hint="Net of refunds" />
        <StatCard label="Monthly recurring revenue" value={money(mrrTotal)} hint={`${mrr?.length ?? 0} recurring memberships`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="aging-h">
          <h2 id="aging-h" className="mb-3 text-base font-semibold">Aging</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Open balances by days overdue</caption>
            <thead className="sr-only"><tr><th scope="col">Bucket</th><th scope="col">Balance</th><th scope="col">Invoices</th></tr></thead>
            <tbody>
              {buckets.map((x) => (
                <tr key={x.b}>
                  <th scope="row" className="w-28 py-1.5 pr-3 text-left font-normal text-fg-secondary">{BUCKET_LABEL[x.b]}</th>
                  <td className="py-1.5">
                    <Link href={`/desk/billing/invoices?status=unpaid&bucket=${encodeURIComponent(x.b)}`} className="flex items-center gap-2 text-fg no-underline">
                      <span aria-hidden className="h-3 rounded-r-[4px] bg-primary" style={{ width: `${Math.max(x.cents ? 2 : 0, (x.cents / max) * 70)}%` }} />
                      <span className="tabular">{money(x.cents)}</span>
                    </Link>
                  </td>
                  <td className="w-20 py-1.5 text-right text-xs text-fg-muted tabular">{x.count} inv.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="owing-h">
          <h2 id="owing-h" className="mb-3 text-base font-semibold">Past-due households</h2>
          {!topOwing.length ? <p className="text-sm text-fg-muted">Nobody is past due.</p> : (
            <ul className="divide-y divide-default text-sm" aria-label="Past-due households">
              {topOwing.map(([id, h]) => (
                <li key={id} className="flex items-center gap-2 py-2">
                  <Link href={`/desk/households/${id}`} className="flex-1">{h.name}</Link>
                  <span className="text-xs text-fg-muted">{h.days} days</span>
                  <span className="tabular font-medium">{money(h.cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="mt-4 rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="runs-h">
        <h2 id="runs-h" className="mb-3 text-base font-semibold">Recent billing runs</h2>
        {!runs?.length ? <p className="text-sm text-fg-muted">The daily billing run hasn&apos;t run yet.</p> : (
          <ul className="divide-y divide-default text-sm" aria-label="Billing runs">
            {runs.map((r) => {
              const errs = (r.errors ?? []) as string[];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-medium tabular">{r.run_date}</span>
                  <Badge variant={r.status === "ok" ? "secondary" : r.status === "error" ? "destructive" : "outline"}>{r.status}</Badge>
                  <span className="text-fg-secondary">{r.invoices_created} invoice{r.invoices_created === 1 ? "" : "s"} · {money(r.amount_cents)} · {r.charges_attempted} autopay attempt{r.charges_attempted === 1 ? "" : "s"}</span>
                  {errs.length ? <span className="w-full text-xs text-warning">{errs.join(" · ")}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
