import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ModuleLocked } from "@/components/billing/module-locked";
import { ProductDetailsForm, ProductImages, VariantRowForm } from "@/components/retail/product-forms";
import { requireSurfacePage } from "@/server/context";
import { signedImages, taxClassOptions } from "@/server/queries/retail";

export const metadata = { title: "Product" };

const dollars = (c: number) => (c / 100).toFixed(2);

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("inventory.manage")) forbidden();
  if (!ctx.modules.has("retail")) return <ModuleLocked title="Product" module="Retail" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await ctx.supabase.from("products").select("id, name, category, description, tax_class, active, images, product_variants(id, sku, barcode, options, price_cents, cost_cents, active, created_at)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [taxClasses, urls, { data: stock }] = await Promise.all([
    taxClassOptions(ctx),
    signedImages(ctx, p.images),
    ctx.supabase.from("v_inventory").select("variant_id, on_hand").eq("product_id", id),
  ]);
  const qty = new Map<string, number>();
  for (const s of stock ?? []) qty.set(s.variant_id ?? "", (qty.get(s.variant_id ?? "") ?? 0) + (s.on_hand ?? 0));
  const variants = [...p.product_variants].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/retail/products">Products</Link>} title={p.name} actions={<Link href={`/desk/retail/inventory?product=${p.id}`} className="text-sm">Stock</Link>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5 lg:col-span-2" aria-labelledby="sizes-h">
          <h2 id="sizes-h" className="mb-3 text-base font-semibold">Sizes &amp; prices</h2>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead className="text-left text-xs text-fg-secondary"><tr><th className="pb-1 pr-2">Size</th><th className="pb-1 pr-2">SKU</th><th className="pb-1 pr-2">Barcode</th><th className="pb-1 pr-2">Price</th><th className="pb-1 pr-2">Cost</th><th className="pb-1 pr-2">Active</th><th className="pb-1"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {variants.map((v) => (
                  <VariantRowForm key={v.id} productId={p.id} row={{ id: v.id, size: String((v.options as { size?: string }).size ?? ""), sku: v.sku, barcode: v.barcode ?? "", price: dollars(v.price_cents), cost: dollars(v.cost_cents), active: v.active }} />
                ))}
                <VariantRowForm productId={p.id} isNew row={{ size: "", sku: "", barcode: "", price: variants[0] ? dollars(variants[0].price_cents) : "", cost: variants[0] ? dollars(variants[0].cost_cents) : "", active: true }} />
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-fg-muted">In stock: {variants.map((v) => `${String((v.options as { size?: string }).size ?? v.sku)} ${qty.get(v.id) ?? 0}`).join(" · ")}</p>
        </section>
        <div className="space-y-4">
          <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="details-h">
            <h2 id="details-h" className="mb-3 text-base font-semibold">Details</h2>
            <ProductDetailsForm product={p} taxClasses={taxClasses} />
          </section>
          <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="images-h">
            <h2 id="images-h" className="mb-3 text-base font-semibold">Images</h2>
            <ProductImages productId={p.id} images={p.images.map((path) => ({ path, url: urls.get(path) ?? null }))} />
          </section>
        </div>
      </div>
    </>
  );
}
