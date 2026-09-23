import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { EmailSaleReceiptButton, ReturnForm } from "@/components/pos/return-form";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Receipt" };

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("retail.sell")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: s } = await ctx.supabase
    .from("pos_sales")
    .select("id, kind, status, receipt_number, subtotal_cents, discount_cents, tax_cents, total_cents, created_at, household_id, original_sale_id, invoice_id, households(name), locations(name), pos_sale_lines(id, qty, unit_cents, discount_cents, tax_cents, total_cents, original_line_id, product_variants(sku, options, products(name))), pos_tenders(method, amount_cents, change_cents)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const { data: returns } = s.kind === "sale" ? await ctx.supabase.from("pos_sales").select("id, receipt_number, total_cents, pos_sale_lines(qty, original_line_id)").eq("original_sale_id", s.id) : { data: [] };
  const returnedBy = new Map<string, number>();
  for (const r of returns ?? []) for (const l of r.pos_sale_lines) if (l.original_line_id) returnedBy.set(l.original_line_id, (returnedBy.get(l.original_line_id) ?? 0) - l.qty);
  const money = (c: number) => formatMoney(c, ctx.currency);
  const label = (l: (typeof s.pos_sale_lines)[number]) => `${l.product_variants?.products?.name ?? l.product_variants?.sku}${(l.product_variants?.options as { size?: string } | null)?.size ? ` (${(l.product_variants?.options as { size?: string }).size})` : ""}`;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/pos">Point of sale</Link>} title={`${s.kind === "return" ? "Return" : "Receipt"} ${s.receipt_number ?? "(open)"}`}
        description={`${s.locations?.name ?? ""} · ${new Date(s.created_at).toLocaleString("en-US", { timeZone: ctx.tz })} · ${s.households?.name ?? "Walk-in"}`}
        actions={s.kind === "sale" && s.status !== "open" ? <EmailSaleReceiptButton saleId={s.id} /> : null} />
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-default bg-surface p-5" aria-label="Receipt">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-default">
              {s.pos_sale_lines.map((l) => (
                <tr key={l.id}><td className="py-1.5">{label(l)} × {Math.abs(l.qty)}{l.discount_cents ? <span className="text-xs text-fg-muted"> (−{money(l.discount_cents)})</span> : null}</td><td className="py-1.5 text-right tabular">{money(l.total_cents)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 space-y-1 border-t border-default pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{money(s.subtotal_cents)}</dd></div>
            {s.discount_cents ? <div className="flex justify-between"><dt>Discounts</dt><dd className="tabular">−{money(s.discount_cents)}</dd></div> : null}
            <div className="flex justify-between"><dt>Tax</dt><dd className="tabular">{money(s.tax_cents)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular">{money(s.total_cents)}</dd></div>
            {s.pos_tenders.map((t, i) => (
              <div key={i} className="flex justify-between text-fg-secondary"><dt className="capitalize">{t.amount_cents < 0 ? `Refund (${t.method})` : t.method}</dt><dd className="tabular">{money(t.amount_cents)}{t.change_cents ? ` · change ${money(t.change_cents)}` : ""}</dd></div>
            ))}
          </dl>
          {s.original_sale_id ? <p className="mt-3 text-sm"><Link href={`/desk/pos/sales/${s.original_sale_id}`}>Original sale</Link></p> : null}
          {returns?.length ? <p className="mt-3 text-sm">Returns: {returns.map((r) => <Link key={r.id} href={`/desk/pos/sales/${r.id}`} className="mr-2">{r.receipt_number} ({money(r.total_cents)})</Link>)}</p> : null}
        </article>
        {s.kind === "sale" && ["completed", "refunded"].includes(s.status) ? (
          <section className="rounded-xl border border-default bg-surface p-5" aria-labelledby="return-h">
            <h2 id="return-h" className="mb-3 text-base font-semibold">Return or exchange</h2>
            <p className="mb-3 text-xs text-fg-muted">Returned items go back into stock. For an exchange, return the item here and ring up the replacement as a new sale.</p>
            <ReturnForm saleId={s.id} currency={ctx.currency} hasHousehold={Boolean(s.household_id)}
              lines={s.pos_sale_lines.map((l) => ({ id: l.id, label: label(l), returnable: l.qty - (returnedBy.get(l.id) ?? 0), unitTotalCents: Math.round(l.total_cents / l.qty) }))} />
          </section>
        ) : null}
      </div>
    </>
  );
}
