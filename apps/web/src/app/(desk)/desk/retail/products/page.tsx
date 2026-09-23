import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { ModuleLocked } from "@/components/billing/module-locked";
import { NewProductDialog } from "@/components/retail/product-forms";
import { RetailTabs } from "@/components/retail/retail-tabs";
import { CATEGORY_LABELS } from "@/lib/validation/retail";
import { requireSurfacePage } from "@/server/context";
import { signedImages, taxClassOptions } from "@/server/queries/retail";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("retail.sell") && !ctx.permissions.has("inventory.manage")) forbidden();
  if (!ctx.modules.has("retail")) return <ModuleLocked title="Products" module="Retail" />;
  const canEdit = ctx.permissions.has("inventory.manage");
  const [{ data: products }, { data: stock }, taxClasses] = await Promise.all([
    ctx.supabase.from("products").select("id, name, category, active, images, product_variants(id, price_cents, active, options)").order("active", { ascending: false }).order("sort").order("name"),
    ctx.supabase.from("v_inventory").select("product_id, on_hand, low"),
    taxClassOptions(ctx),
  ]);
  const onHand = new Map<string, { qty: number; low: number }>();
  for (const s of stock ?? []) {
    const cur = onHand.get(s.product_id ?? "") ?? { qty: 0, low: 0 };
    cur.qty += s.on_hand ?? 0;
    if (s.low) cur.low++;
    onHand.set(s.product_id ?? "", cur);
  }
  const thumbs = await signedImages(ctx, (products ?? []).flatMap((p) => (p.images[0] ? [p.images[0]] : [])));
  return (
    <>
      <PageHeader title="Retail" description="Products, stock and suppliers." actions={canEdit ? <NewProductDialog taxClasses={taxClasses} /> : null} />
      <RetailTabs current="/desk/retail/products" />
      {!products?.length ? <EmptyState title="No products yet" description="Add uniforms, belts and gear to sell them and include them in enrollment kits." /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Products">
          {products.map((p) => {
            const variants = p.product_variants.filter((v) => v.active);
            const prices = variants.map((v) => v.price_cents);
            const s = onHand.get(p.id);
            const thumb = p.images[0] ? thumbs.get(p.images[0]) : null;
            return (
              <li key={p.id} aria-label={p.name} className={`flex items-center gap-3 px-4 py-3 ${p.active ? "" : "opacity-60"}`}>
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
                  <img src={thumb} alt="" className="size-12 rounded-md border border-default object-cover" />
                ) : <div aria-hidden className="size-12 rounded-md bg-elevated" />}
                <div className="min-w-0 flex-1">
                  <Link href={`/desk/retail/products/${p.id}`} className="font-medium">{p.name}</Link>
                  <div className="text-sm text-fg-secondary">
                    {CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] ?? p.category} · {variants.length} size{variants.length === 1 ? "" : "s"}
                    {prices.length ? ` · ${formatMoney(Math.min(...prices), ctx.currency)}${Math.max(...prices) !== Math.min(...prices) ? `–${formatMoney(Math.max(...prices), ctx.currency)}` : ""}` : ""}
                  </div>
                </div>
                <span className="text-sm tabular text-fg-secondary">{s?.qty ?? 0} in stock</span>
                {s?.low ? <Badge variant="destructive">{s.low} low</Badge> : null}
                {!p.active ? <Badge variant="outline">Inactive</Badge> : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
