import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ModuleLocked } from "@/components/billing/module-locked";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Movement ledger" };

const REASON: Record<string, string> = { sale: "Sale", return: "Return", receive: "Received", adjust: "Adjustment", transfer: "Transfer", package: "Enrollment kit" };

export default async function MovementsPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("retail.sell") && !ctx.permissions.has("inventory.manage")) forbidden();
  if (!ctx.modules.has("retail")) return <ModuleLocked title="Movement ledger" module="Retail" />;
  const { data: rows } = await ctx.supabase.from("inventory_movements").select("id, delta, reason, note, created_at, ref_type, product_variants(sku, options, products(name)), locations(name)").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/retail/inventory">Inventory</Link>} title="Movement ledger" description="Every stock change, newest first." />
      {!rows?.length ? <EmptyState title="No movements yet" /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface text-sm" aria-label="Movements">
          {rows.map((m) => {
            const size = (m.product_variants?.options as { size?: string } | null)?.size;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <span className={`w-12 text-right font-medium tabular ${m.delta < 0 ? "text-danger" : "text-success"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                <span className="font-medium">{m.product_variants?.products?.name}{size ? ` (${size})` : ""}</span>
                <span className="text-fg-secondary">{REASON[m.reason] ?? m.reason}{m.note ? ` · ${m.note}` : ""}</span>
                <span className="ml-auto text-xs text-fg-muted">{m.locations?.name} · {new Date(m.created_at).toLocaleString("en-US", { timeZone: ctx.tz })}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
