import "server-only";
import type { Ctx } from "../context";

export interface SavedCard {
  id: string;
  kind: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

export interface PaymentRow {
  id: string;
  amount_cents: number;
  refunded_cents: number;
  method: string;
  status: string;
  received_at: string;
  failure_message: string | null;
  memo: string | null;
  invoice_id: string | null;
}

/** Active saved payment methods for a household (RLS: billing.read staff or the household's own members). */
export async function listSavedCards(ctx: Ctx, householdId: string): Promise<SavedCard[]> {
  const { data } = await ctx.supabase
    .from("payment_methods")
    .select("id, kind, brand, last4, exp_month, exp_year, is_default")
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function listRecentPayments(ctx: Ctx, householdId: string, limit = 10): Promise<PaymentRow[]> {
  const { data } = await ctx.supabase
    .from("payments")
    .select("id, amount_cents, refunded_cents, method, status, received_at, failure_message, memo, invoice_id")
    .eq("household_id", householdId)
    .order("received_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
