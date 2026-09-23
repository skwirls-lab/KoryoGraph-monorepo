"use server";

import { DbError, rpc } from "@koryo/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { parseMoney } from "@/lib/curriculum";
import { PRODUCT_CATEGORIES, productSchema, supplierSchema, variantSchema, type ProductInput, type SupplierInput, type VariantInput } from "@/lib/validation/retail";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";

const need = { permission: "inventory.manage", module: "retail" } as const;
const skuPart = (s: string) => s.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase().slice(0, 24);
const dbMessage = (err: unknown, fallback: string) => (err instanceof DbError && ["22023", "P0002"].includes(err.code ?? "") ? err.message.charAt(0).toUpperCase() + err.message.slice(1) + "." : fallback);

/** Create a product; `sizes` (comma separated) become one variant each at the given price/cost. */
export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const price = parseMoney(v.price);
  const cost = parseMoney(v.cost);
  if (price === null) return fail("Check the highlighted fields", { price: "Enter a price like 55.00" });
  if (cost === null) return fail("Check the highlighted fields", { cost: "Enter a cost like 22.00" });
  const sizes = [...new Set(v.sizes.split(",").map((s) => s.trim()).filter(Boolean))];
  const { data: product, error } = await ctx.supabase.from("products")
    .insert({ tenant_id: ctx.tenantId as string, name: v.name, category: v.category, description: v.description, tax_class: v.taxClass })
    .select("id").single();
  if (error || !product) return fail("Couldn't create the product.");
  const base = skuPart(v.skuPrefix || v.name);
  const { data: taken } = await ctx.supabase.from("product_variants").select("sku").ilike("sku", `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.sku.toUpperCase()));
  const rows = (sizes.length ? sizes : [""]).map((size) => {
    let sku = size ? `${base}-${skuPart(size)}` : base;
    for (let n = 2; used.has(sku); n++) sku = `${size ? `${base}-${skuPart(size)}` : base}-${n}`;
    used.add(sku);
    return { tenant_id: ctx.tenantId as string, product_id: product.id, sku, options: size ? { size } : {}, price_cents: price, cost_cents: cost };
  });
  const { error: vErr } = await ctx.supabase.from("product_variants").insert(rows);
  if (vErr) {
    await ctx.supabase.from("products").delete().eq("id", product.id);
    return fail("Couldn't create the product's sizes.");
  }
  revalidatePath("/desk/retail/products");
  redirect(`/desk/retail/products/${product.id}`);
}

export async function updateProduct(input: { id: string; name: string; category: string; description: string; taxClass: string; active: boolean }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({
    id: z.uuid(), name: z.string().trim().min(2).max(120), category: z.enum(PRODUCT_CATEGORIES), description: z.string().trim().max(2000),
    taxClass: z.string().trim().min(1).max(40), active: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) return fail("Check the product details");
  const v = parsed.data;
  const { error } = await ctx.supabase.from("products").update({ name: v.name, category: v.category, description: v.description, tax_class: v.taxClass, active: v.active }).eq("id", v.id);
  if (error) return fail("Couldn't save the product.");
  revalidatePath(`/desk/retail/products/${v.id}`);
  return ok();
}

export async function saveVariant(input: VariantInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the size", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const price = parseMoney(v.price);
  const cost = parseMoney(v.cost);
  if (price === null || cost === null) return fail("Enter prices like 55.00");
  const row = { sku: v.sku.toUpperCase(), barcode: v.barcode || null, options: v.size ? { size: v.size } : {}, price_cents: price, cost_cents: cost, active: v.active };
  const { error } = v.id
    ? await ctx.supabase.from("product_variants").update(row).eq("id", v.id)
    : await ctx.supabase.from("product_variants").insert({ ...row, tenant_id: ctx.tenantId as string, product_id: v.productId });
  if (error) return fail(error.code === "23505" ? "That SKU is already used by another item." : "Couldn't save the size.");
  revalidatePath(`/desk/retail/products/${v.productId}`);
  return ok();
}

/** Upload product photos to "<tenant>/products/<product>/…" (private bucket; shown via signed URLs). */
export async function uploadProductImage(form: FormData): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const productId = String(form.get("productId") ?? "");
  const file = form.get("file");
  if (!z.uuid().safeParse(productId).success || !(file instanceof File) || file.size === 0) return fail("Choose an image.");
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return fail("Images must be PNG, JPEG, WebP or GIF.");
  if (file.size > 5 * 1024 * 1024) return fail("Images must be 5 MB or smaller.");
  const { data: p } = await ctx.supabase.from("products").select("id, images").eq("id", productId).maybeSingle();
  if (!p) return fail("Product not found.");
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "img";
  const path = `${ctx.tenantId}/products/${productId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await ctx.supabase.storage.from("tenant-media").upload(path, file, { contentType: file.type });
  if (upErr) return fail("Couldn't upload the image.");
  const { error } = await ctx.supabase.from("products").update({ images: [...p.images, path] }).eq("id", productId);
  if (error) {
    await ctx.supabase.storage.from("tenant-media").remove([path]);
    return fail("Couldn't save the image.");
  }
  revalidatePath(`/desk/retail/products/${productId}`);
  return ok();
}

export async function removeProductImage(input: { productId: string; path: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const { data: p } = await ctx.supabase.from("products").select("id, images").eq("id", input.productId).maybeSingle();
  if (!p || !p.images.includes(input.path)) return fail("Image not found.");
  await ctx.supabase.from("products").update({ images: p.images.filter((i) => i !== input.path) }).eq("id", p.id);
  await ctx.supabase.storage.from("tenant-media").remove([input.path]);
  revalidatePath(`/desk/retail/products/${p.id}`);
  return ok();
}

const adjustSchema = z.object({
  variantId: z.uuid(),
  locationId: z.uuid(),
  delta: z.coerce.number().int().refine((n) => n !== 0, { error: "Enter a quantity other than zero" }),
  reason: z.enum(["receive", "adjust", "return", "transfer"]),
  note: z.string().trim().max(300).default(""),
});

export async function adjustStock(input: z.input<typeof adjustSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the adjustment");
  const v = parsed.data;
  try {
    await rpc(ctx.supabase, "adjust_inventory", { p_variant_id: v.variantId, p_location_id: v.locationId, p_delta: v.delta, p_reason: v.reason, p_note: v.note });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't adjust the stock."));
  }
  revalidatePath("/desk/retail/inventory");
  return ok();
}

export async function setReorderPoint(input: { variantId: string; locationId: string; reorderPoint: number }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = z.object({ variantId: z.uuid(), locationId: z.uuid(), reorderPoint: z.coerce.number().int().min(0).max(100000) }).safeParse(input);
  if (!parsed.success) return fail("Enter a reorder point of zero or more.");
  try {
    await rpc(ctx.supabase, "set_reorder_point", { p_variant_id: parsed.data.variantId, p_location_id: parsed.data.locationId, p_reorder_point: parsed.data.reorderPoint });
  } catch (err) {
    return fail(dbMessage(err, "Couldn't save the reorder point."));
  }
  revalidatePath("/desk/retail/inventory");
  return ok();
}

export async function saveSupplier(input: SupplierInput): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, need);
  if (denied) return denied;
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const row = { name: v.name, contact: { person: v.contactName, email: v.email, phone: v.phone, website: v.website }, notes: v.notes || null, active: v.active };
  const { error } = v.id
    ? await ctx.supabase.from("suppliers").update(row).eq("id", v.id)
    : await ctx.supabase.from("suppliers").insert({ ...row, tenant_id: ctx.tenantId as string });
  if (error) return fail("Couldn't save the supplier.");
  revalidatePath("/desk/retail/suppliers");
  return ok();
}
