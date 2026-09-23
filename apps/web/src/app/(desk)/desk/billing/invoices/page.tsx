import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ModuleLocked } from "@/components/billing/module-locked";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status";
import { Pagination } from "@/components/common/pagination";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Invoices" };

const PAGE = 50;
const FILTERS = [
  { key: "unpaid", label: "Unpaid", statuses: ["open", "partially_paid", "past_due"] },
  { key: "past_due", label: "Past due", statuses: ["past_due"] },
  { key: "paid", label: "Paid", statuses: ["paid"] },
  { key: "void", label: "Void & refunded", statuses: ["void", "refunded"] },
  { key: "all", label: "All", statuses: [] as string[] },
] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; bucket?: string; q?: string; page?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("billing.read")) forbidden();
  if (!ctx.modules.has("billing")) return <ModuleLocked title="Invoices" />;
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();

  let bucketIds: string[] | null = null;
  if (sp.bucket) {
    const { data } = await ctx.supabase.from("v_ar_aging").select("invoice_id").eq("bucket", sp.bucket);
    bucketIds = (data ?? []).map((r) => r.invoice_id ?? "").filter(Boolean);
  }
  let query = ctx.supabase
    .from("invoices")
    .select("id, number, status, issued_at, due_at, total_cents, balance_cents, household_id, households!inner(name), people(first_name, last_name, preferred_name)", { count: "exact" })
    .order("issued_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (filter.statuses.length) query = query.in("status", filter.statuses);
  if (bucketIds) query = query.in("id", bucketIds.length ? bucketIds : ["00000000-0000-0000-0000-000000000000"]);
  if (q) query = /^\d+$/.test(q) ? query.eq("number", Number(q)) : query.ilike("households.name", `%${q.replace(/[%_]/g, "")}%`);
  const { data: invoices, count } = await query;

  const link = (key: string) => `/desk/billing/invoices?status=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/billing">Billing</Link>} title="Invoices" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <nav aria-label="Invoice filters" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link key={f.key} href={link(f.key)} aria-current={f.key === filter.key ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm no-underline ${f.key === filter.key ? "bg-primary text-primary-foreground" : "bg-elevated text-fg-secondary"}`}>{f.label}</Link>
          ))}
        </nav>
        {sp.bucket ? <span className="text-sm text-fg-secondary">Aging: {sp.bucket} <Link href={link(filter.key)}>clear</Link></span> : null}
        <form className="ml-auto" role="search">
          <input type="hidden" name="status" value={filter.key} />
          <label className="sr-only" htmlFor="invoice-q">Search invoices</label>
          <input id="invoice-q" name="q" defaultValue={q} placeholder="Household or invoice #" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
        </form>
      </div>
      {!invoices?.length ? <EmptyState title="No invoices" description="Nothing matches these filters." /> : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-default text-left text-xs text-fg-secondary">
              <tr><th className="px-4 py-2">Invoice</th><th className="px-4 py-2">Household</th><th className="px-4 py-2">Issued</th><th className="px-4 py-2">Due</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Balance</th><th className="px-4 py-2">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-default">
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2"><Link href={`/desk/billing/invoices/${i.id}`}>#{i.number}</Link></td>
                  <td className="px-4 py-2">{i.households?.name}{i.people ? <span className="text-fg-muted"> · {i.people.preferred_name || i.people.first_name}</span> : null}</td>
                  <td className="px-4 py-2 tabular">{new Date(i.issued_at).toLocaleDateString("en-US", { timeZone: ctx.tz })}</td>
                  <td className="px-4 py-2 tabular">{i.due_at}</td>
                  <td className="px-4 py-2 text-right tabular">{formatMoney(i.total_cents, ctx.currency)}</td>
                  <td className="px-4 py-2 text-right tabular">{formatMoney(i.balance_cents, ctx.currency)}</td>
                  <td className="px-4 py-2"><InvoiceStatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3"><Pagination basePath="/desk/billing/invoices" params={{ status: filter.key, q, bucket: sp.bucket }} page={page} pageSize={PAGE} total={count ?? 0} /></div>
    </>
  );
}
