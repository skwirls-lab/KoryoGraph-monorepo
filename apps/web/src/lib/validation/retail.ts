import { z } from "zod";

export const PRODUCT_CATEGORIES = ["uniforms", "sparring_gear", "belts", "weapons", "apparel", "consumables", "other"] as const;
export const CATEGORY_LABELS: Record<(typeof PRODUCT_CATEGORIES)[number], string> = {
  uniforms: "Uniforms", sparring_gear: "Sparring gear", belts: "Belts", weapons: "Weapons", apparel: "Apparel", consumables: "Consumables", other: "Other",
};

const money = z.string().trim().regex(/^\$?\d{1,6}(\.\d{1,2})?$/, { error: "Enter an amount like 55.00" });

export const productSchema = z.object({
  name: z.string().trim().min(2, { error: "Name the product" }).max(120),
  category: z.enum(PRODUCT_CATEGORIES),
  description: z.string().trim().max(2000).default(""),
  taxClass: z.string().trim().min(1).max(40).default("retail"),
  sizes: z.string().trim().max(500).default(""),
  price: money,
  cost: money.or(z.literal("")).default(""),
  skuPrefix: z.string().trim().max(24).default(""),
});
export type ProductInput = z.input<typeof productSchema>;

export const variantSchema = z.object({
  id: z.uuid().optional(),
  productId: z.uuid(),
  size: z.string().trim().max(40).default(""),
  sku: z.string().trim().min(1, { error: "SKU is required" }).max(64).regex(/^[A-Za-z0-9._-]+$/, { error: "Letters, numbers, dots, dashes" }),
  barcode: z.string().trim().max(64).regex(/^[0-9A-Za-z-]*$/, { error: "Digits and letters only" }).default(""),
  price: money,
  cost: money.or(z.literal("")).default(""),
  active: z.boolean().default(true),
});
export type VariantInput = z.input<typeof variantSchema>;

export const supplierSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, { error: "Name the supplier" }).max(120),
  contactName: z.string().trim().max(120).default(""),
  email: z.email({ error: "Enter a valid email" }).or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  website: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(2000).default(""),
  active: z.boolean().default(true),
});
export type SupplierInput = z.input<typeof supplierSchema>;
