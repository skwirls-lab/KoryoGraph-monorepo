import "server-only";
import { computeInvoice, type ComputedInvoice } from "@koryo/billing";
import type { Ctx } from "../context";

export interface CartLineInput {
  variantId: string;
  qty: number;
  /** Line discount in cents (already resolved from % on the client). */
  discountCents: number;
}

export interface PricedLine {
  variantId: string;
  description: string;
  qty: number;
  unitCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  taxRate: number;
}

/**
 * Prices a cart from the database (never client prices) with the billing engine: line discounts, tax by the
 * product's tax class at the sale's location (location-specific rates plus school-wide ones).
 */
export async function priceCart(ctx: Ctx, locationId: string, lines: CartLineInput[]): Promise<{ lines: PricedLine[]; invoice: ComputedInvoice } | { error: string }> {
  const ids = [...new Set(lines.map((l) => l.variantId))];
  const [{ data: variants }, { data: rates }] = await Promise.all([
    ctx.supabase.from("product_variants").select("id, price_cents, options, active, products(name, tax_class, active)").in("id", ids),
    ctx.supabase.from("tax_rates").select("rate, applies_to, location_id").or(`location_id.is.null,location_id.eq.${locationId}`),
  ]);
  const byId = new Map((variants ?? []).map((v) => [v.id, v]));
  const taxRates: Record<string, number> = {};
  for (const r of rates ?? []) for (const c of r.applies_to) taxRates[c] = (taxRates[c] ?? 0) + Number(r.rate);
  const input = [];
  for (const l of lines) {
    const v = byId.get(l.variantId);
    if (!v || !v.active || !v.products?.active) return { error: "An item in the cart is no longer sold." };
    const size = (v.options as { size?: string } | null)?.size;
    const gross = v.price_cents * l.qty;
    input.push({
      kind: "product" as const,
      description: `${v.products.name}${size ? ` (${size})` : ""}`,
      unitCents: v.price_cents,
      quantity: l.qty,
      taxClass: v.products.tax_class,
      discountable: true,
      lineDiscountCents: Math.min(Math.max(0, l.discountCents), gross),
    });
  }
  const invoice = computeInvoice(input, [], taxRates);
  return {
    invoice,
    lines: invoice.lines.map((c, i) => ({
      variantId: lines[i]?.variantId ?? "", description: c.description, qty: c.quantity, unitCents: c.unitCents,
      discountCents: c.discountCents, taxCents: c.taxCents, totalCents: c.totalCents, taxRate: c.taxRate,
    })),
  };
}
