"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form } from "@koryo/ui/components/ui/form";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { FormError } from "@/components/forms/form-error";
import { SelectField, selectClass } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { CATEGORY_LABELS, PRODUCT_CATEGORIES, productSchema } from "@/lib/validation/retail";
import { createProduct, removeProductImage, saveVariant, updateProduct, uploadProductImage } from "@/server/actions/retail";

const categoryOptions = PRODUCT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

export function NewProductDialog({ taxClasses }: { taxClasses: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const { form, pending, submit } = useActionForm({
    schema: productSchema,
    defaultValues: { name: "", category: "uniforms", description: "", taxClass: taxClasses.find((t) => t.value === "retail")?.value ?? "exempt", sizes: "", price: "", cost: "", skuPrefix: "" },
    action: createProduct,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New product</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>Each size becomes its own item with a SKU and stock level. You can change prices per size later.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <TextField form={form} name="name" label="Name" placeholder="Dobok (uniform)" />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField form={form} name="category" label="Category" options={categoryOptions} />
              <SelectField form={form} name="taxClass" label="Tax" options={taxClasses} />
            </div>
            <TextField form={form} name="sizes" label="Sizes" placeholder="S, M, L" description="Comma separated. Leave empty for a single item." />
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField form={form} name="price" label="Price" inputMode="decimal" placeholder="55.00" />
              <TextField form={form} name="cost" label="Cost" inputMode="decimal" placeholder="22.00" />
              <TextField form={form} name="skuPrefix" label="SKU prefix" placeholder="Auto" />
            </div>
            <TextField form={form} name="description" label="Description" />
            <FormError form={form} />
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create product"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductDetailsForm({ product, taxClasses }: { product: { id: string; name: string; category: string; description: string; tax_class: string; active: boolean }; taxClasses: { value: string; label: string }[] }) {
  const [v, setV] = useState({ name: product.name, category: product.category, description: product.description, taxClass: product.tax_class, active: product.active });
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await updateProduct({ id: product.id, ...v });
        if (r.ok) toast.success("Product saved");
        else toast.error(r.error);
        router.refresh();
      });
    }}>
      <div className="space-y-1"><Label htmlFor="p-name">Name</Label><Input id="p-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="p-cat">Category</Label>
          <select id="p-cat" className={selectClass} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{categoryOptions.map((o) => <option key={o.value} value={o.value} className="bg-surface">{o.label}</option>)}</select>
        </div>
        <div className="space-y-1"><Label htmlFor="p-tax">Tax</Label>
          <select id="p-tax" className={selectClass} value={v.taxClass} onChange={(e) => setV({ ...v, taxClass: e.target.value })}>{taxClasses.map((o) => <option key={o.value} value={o.value} className="bg-surface">{o.label}</option>)}</select>
        </div>
      </div>
      <div className="space-y-1"><Label htmlFor="p-desc">Description</Label><Input id="p-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="accent-[var(--color-primary)]" /> Active (sold and shown in POS)</label>
      <Button type="submit" size="sm" disabled={pending}>Save</Button>
    </form>
  );
}

export interface VariantRow { id?: string; size: string; sku: string; barcode: string; price: string; cost: string; active: boolean }

/** One editable row of the variants grid (also used, empty, to add a size). */
export function VariantRowForm({ productId, row, isNew }: { productId: string; row: VariantRow; isNew?: boolean }) {
  const [v, setV] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = isNew ? "new size" : `size ${row.size || row.sku}`;
  const dirty = JSON.stringify(v) !== JSON.stringify(row);
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-2"><Input aria-label={`Size (${label})`} value={v.size} onChange={(e) => setV({ ...v, size: e.target.value })} className="h-8 w-24" /></td>
      <td className="py-1.5 pr-2"><Input aria-label={`SKU (${label})`} value={v.sku} onChange={(e) => setV({ ...v, sku: e.target.value.toUpperCase() })} className="h-8 w-36" /></td>
      <td className="py-1.5 pr-2"><Input aria-label={`Barcode (${label})`} value={v.barcode} onChange={(e) => setV({ ...v, barcode: e.target.value })} className="h-8 w-36" inputMode="numeric" /></td>
      <td className="py-1.5 pr-2"><Input aria-label={`Price (${label})`} value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} className="h-8 w-24" inputMode="decimal" /></td>
      <td className="py-1.5 pr-2"><Input aria-label={`Cost (${label})`} value={v.cost} onChange={(e) => setV({ ...v, cost: e.target.value })} className="h-8 w-24" inputMode="decimal" /></td>
      <td className="py-1.5 pr-2 text-center"><input type="checkbox" aria-label={`Active (${label})`} checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="mt-2 accent-[var(--color-primary)]" /></td>
      <td className="py-1.5">
        <Button size="sm" variant={isNew ? "default" : "outline"} disabled={pending || (!isNew && !dirty)} onClick={() => start(async () => {
          const r = await saveVariant({ ...v, id: row.id, productId });
          if (!r.ok) {
            setError(r.error);
            return;
          }
          setError(null);
          toast.success(isNew ? "Size added" : "Saved");
          if (isNew) setV(row);
          router.refresh();
        })}>{isNew ? "Add" : "Save"}</Button>
        {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
      </td>
    </tr>
  );
}

export function ProductImages({ productId, images }: { productId: string; images: { path: string; url: string | null }[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-3" aria-label="Product images">
        {images.map((img) => (
          <li key={img.path} className="relative">
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
              <img src={img.url} alt="Product" className="size-24 rounded-lg border border-default object-cover" />
            ) : <div className="size-24 rounded-lg bg-elevated" />}
            <Button size="sm" variant="ghost" className="absolute -right-2 -top-2 h-6 rounded-full bg-surface px-2 text-xs text-danger" aria-label="Remove image" disabled={pending}
              onClick={() => start(async () => { const r = await removeProductImage({ productId, path: img.path }); if (!r.ok) toast.error(r.error); router.refresh(); })}>×</Button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => {
        e.preventDefault();
        const file = inputRef.current?.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.set("productId", productId);
        fd.set("file", file);
        start(async () => {
          const r = await uploadProductImage(fd);
          if (r.ok) toast.success("Image added");
          else toast.error(r.error);
          if (inputRef.current) inputRef.current.value = "";
          router.refresh();
        });
      }} className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="product-image">Image</label>
        <input ref={inputRef} id="product-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="text-sm" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>Upload</Button>
      </form>
    </div>
  );
}
