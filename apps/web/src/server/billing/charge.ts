import "server-only";
import { rpc } from "@koryo/db";
import type { Database, Json } from "@koryo/db/types";
import { chargeCard, feeBpsFromEnv, type Stripe } from "@koryo/payments";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient<Database>;

export interface InvoiceChargeResult {
  status: "succeeded" | "pending" | "failed" | "no_card";
  error?: string;
}

/**
 * Charges an invoice's balance to a saved card (the given one, else the membership's autopay card, else the
 * household default), off-session, and records the PaymentIntent in the ledger. `as` picks the recording
 * RPC: "service" for jobs (service role), "staff" for a signed-in user with billing.charge.
 */
export async function chargeInvoiceWithCard(
  db: Db,
  stripe: Stripe,
  t: { tenantId: string; account: string; currency: string },
  invoiceId: string,
  opts: { attemptKey: string; paymentMethodId?: string | null; as: "service" | "staff"; description?: string },
): Promise<InvoiceChargeResult> {
  const { data: inv } = await db.from("invoices").select("id, household_id, balance_cents, number, memberships(payment_method_id), households(stripe_customer_id)").eq("id", invoiceId).maybeSingle();
  if (!inv || inv.balance_cents <= 0) return { status: "failed", error: "Nothing is due on this invoice." };
  const pmId = opts.paymentMethodId ?? inv.memberships?.payment_method_id ?? null;
  let pmQuery = db.from("payment_methods").select("stripe_payment_method_id").eq("household_id", inv.household_id).eq("status", "active");
  pmQuery = pmId ? pmQuery.eq("id", pmId) : pmQuery.eq("is_default", true);
  const { data: pm } = await pmQuery.limit(1).maybeSingle();
  const customer = inv.households?.stripe_customer_id;
  if (!pm || !customer) return { status: "no_card", error: "No usable card on file." };
  if (inv.balance_cents < 50) return { status: "failed", error: "The balance is below the card minimum." };
  const pi = await chargeCard(stripe, t.account, {
    tenantId: t.tenantId, householdId: inv.household_id, customerId: customer, amountCents: inv.balance_cents, currency: t.currency,
    paymentMethodId: pm.stripe_payment_method_id, offSession: true, invoiceId: inv.id, attemptKey: opts.attemptKey,
    description: opts.description ?? `Invoice #${inv.number}`, feeBps: feeBpsFromEnv(),
  });
  if (opts.as === "service") await rpc(db, "record_payment_intent_for", { p_tenant_id: t.tenantId, p_pi: pi as unknown as Json });
  else await rpc(db, "record_payment_intent", { p_pi: pi as unknown as Json });
  if (pi.status === "succeeded") return { status: "succeeded" };
  if (pi.status === "processing") return { status: "pending" };
  return { status: "failed", error: pi.last_payment_error?.message ?? "The card was declined." };
}
