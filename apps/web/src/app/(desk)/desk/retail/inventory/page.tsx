import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { ModuleLocked } from "@/components/billing/module-locked";
import { RetailTabs } from "@/components/retail/retail-tabs";
import { AdjustStockDialog, ReorderPointInput } from "@/components/retail/stock-controls";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ location?: string; low?: string; product?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("retail.sell") && !ctx.permissions.has("inventory.manage")) forbidden();
  if (!ctx.modules.has("retail")) return <ModuleLocked title="Inventory" module="Retail" />;
  const sp = await searchParams;
  const { data: locations } = await ctx.supabase.from("locations").select("id, name, is_default").order("is_default", { ascending: false }).order("name");
  const location = locations?.find((l) => l.id === sp.location) ?? locations?.[0];
  if (!location) return <EmptyState title="No locations" description="Add a location first." />;
  let q = ctx.supabase.from("v_inventory").select("*").eq("location_id", location.id).order("product_name").order("sku");
  if (sp.low === "1") q = q.eq("low", true);
  if (sp.product) q = q.eq("product_id", sp.product);
  const { data: rows } = await q;
  const { count: lowCount } = await ctx.supabase.from("v_inventory").select("variant_id", { count: "exact", head: true }).eq("location_id", location.id).eq("low", true);
  const canEdit = ctx.permissions.has("inventory.manage");
  const qs = (extra: Record<string, string>) => `/desk/retail/inventory?${new URLSearchParams({ location: location.id, ...extra }).toString()}`;
  return (
    <>
      <PageHeader title="Retail" description="Products, stock and suppliers." actions={<Link href="/desk/retail/inventory/movements" className="text-sm">Movement ledger</Link>} />
      <RetailTabs current="/desk/retail/inventory" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {locations && locations.length > 1 ? (
          <nav aria-label="Location" className="flex gap-1">
            {locations.map((l) => <Link key={l.id} href={`/desk/retail/inventory?location=${l.id}`} aria-current={l.id === location.id ? "page" : undefined} className={`rounded-md px-2 py-1 text-sm ${l.id === location.id ? "bg-elevated font-medium" : ""}`}>{l.name}</Link>)}
          </nav>
        ) : <span className="text-sm text-fg-secondary">{location.name}</span>}
        <Link href={sp.low === "1" ? qs({}) : qs({ low: "1" })} className="ml-auto text-sm">{sp.low === "1" ? "Show all" : `Low stock only${lowCount ? ` (${lowCount})` : ""}`}</Link>
      </div>
      {!rows?.length ? <EmptyState title={sp.low === "1" ? "Nothing is low" : "No items"} description={sp.low === "1" ? "Every item is at or above its reorder point." : "Add products first."} /> : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Stock at {location.name}</caption>
            <thead className="border-b border-default text-left text-xs text-fg-secondary">
              <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">SKU</th><th className="px-4 py-2 text-right">On hand</th><th className="px-4 py-2 text-right">Reserved</th><th className="px-4 py-2 text-right">Reorder at</th><th className="px-4 py-2"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-default">
              {rows.map((r) => {
                const size = (r.options as { size?: string } | null)?.size;
                const label = `${r.product_name}${size ? ` (${size})` : ""}`;
                return (
                  <tr key={r.variant_id} aria-label={label}>
                    <td className="px-4 py-2">{label} {r.low ? <Badge variant="destructive" className="ml-1">Low</Badge> : null}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.sku}</td>
                    <td className="px-4 py-2 text-right tabular">{r.on_hand}</td>
                    <td className="px-4 py-2 text-right tabular text-fg-secondary">{r.reserved}</td>
                    <td className="px-4 py-2 text-right">{canEdit && r.variant_id ? <ReorderPointInput variantId={r.variant_id} locationId={location.id} value={r.reorder_point ?? 0} label={label} /> : <span className="tabular">{r.reorder_point}</span>}</td>
                    <td className="px-4 py-2 text-right">{canEdit && r.variant_id ? <AdjustStockDialog variantId={r.variant_id} locationId={location.id} label={label} onHand={r.on_hand ?? 0} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
