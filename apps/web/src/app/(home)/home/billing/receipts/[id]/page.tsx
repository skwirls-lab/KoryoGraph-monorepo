import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Receipt" };

/** A printable receipt for one of the family's payments (RLS: own household only). */
export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("home");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await ctx.supabase
    .from("payments")
    .select("id, amount_cents, refunded_cents, method, status, received_at, households(name), invoices(number, total_cents, balance_cents, invoice_lines(description, total_cents))")
    .eq("id", id)
    .maybeSingle();
  if (!p || !["succeeded", "partially_refunded", "refunded"].includes(p.status)) notFound();
  const money = (c: number) => formatMoney(c, ctx.currency);
  return (
    <>
      <PageHeader eyebrow={<Link href="/home/billing">Billing</Link>} title="Receipt" description={ctx.tenantName ?? undefined} />
      <article className="max-w-lg space-y-4 rounded-xl border border-default bg-surface p-5 print:border-0">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Received from</dt><dd>{p.households?.name}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Date</dt><dd>{new Date(p.received_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "long", timeStyle: "short" })}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Method</dt><dd className="capitalize">{p.method}</dd></div>
          {p.invoices ? <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Invoice</dt><dd>#{p.invoices.number}</dd></div> : null}
          <div className="flex justify-between gap-2 text-base font-semibold"><dt>Amount paid</dt><dd className="tabular">{money(p.amount_cents)}</dd></div>
          {p.refunded_cents ? <div className="flex justify-between gap-2"><dt className="text-fg-secondary">Refunded</dt><dd className="tabular">−{money(p.refunded_cents)}</dd></div> : null}
        </dl>
        {p.invoices?.invoice_lines?.length ? (
          <table className="w-full text-sm">
            <caption className="mb-1 text-left text-xs text-fg-secondary">Invoice #{p.invoices.number}</caption>
            <tbody className="divide-y divide-default">
              {p.invoices.invoice_lines.map((l, i) => <tr key={i}><td className="py-1.5">{l.description}</td><td className="py-1.5 text-right tabular">{money(l.total_cents)}</td></tr>)}
            </tbody>
          </table>
        ) : null}
        {p.invoices ? <p className="text-xs text-fg-muted">Invoice balance remaining: {money(p.invoices.balance_cents)}</p> : null}
      </article>
    </>
  );
}
