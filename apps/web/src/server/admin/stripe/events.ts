import "server-only";
import { rpc } from "@koryo/db";
import type { Json } from "@koryo/db/types";
import type { ServiceClient } from "@koryo/db/service";
import { accountStatus, isHandledEvent, type Stripe } from "@koryo/payments";
import { logger } from "@/server/log";

export type StripeEventOutcome = "processed" | "duplicate" | "ignored" | "failed";

export interface StripeEventResult {
  outcome: StripeEventOutcome;
  detail?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

const asJson = (v: unknown) => v as Json;

async function tenantForAccount(db: ServiceClient, account: string | null | undefined): Promise<string | null> {
  if (!account) return null;
  const { data } = await db.from("tenants").select("id").eq("stripe_account_id", account).maybeSingle();
  return data?.id ?? null;
}

async function householdFor(db: ServiceClient, tenantId: string, metadataHousehold: string | undefined, customer: string | null): Promise<string | null> {
  if (metadataHousehold && UUID.test(metadataHousehold)) {
    const { data } = await db.from("households").select("id").eq("tenant_id", tenantId).eq("id", metadataHousehold).maybeSingle();
    if (data) return data.id;
  }
  if (!customer) return null;
  const { data } = await db.from("households").select("id").eq("tenant_id", tenantId).eq("stripe_customer_id", customer).limit(1).maybeSingle();
  return data?.id ?? null;
}

type Handler = (args: { db: ServiceClient; stripe: Stripe | null; tenantId: string; event: Stripe.Event; account: string }) => Promise<string>;

async function recordPaymentMethod(db: ServiceClient, tenantId: string, pm: Stripe.PaymentMethod, householdHint?: string): Promise<string> {
  const householdId = await householdFor(db, tenantId, householdHint, idOf(pm.customer));
  if (!householdId) return "no household for this payment method's customer";
  await rpc(db, "record_payment_method_for", { p_tenant_id: tenantId, p_household_id: householdId, p_pm: asJson(pm) });
  return `payment method ${pm.id} recorded`;
}

const handlers: Record<string, Handler> = {
  "payment_intent.succeeded": paymentIntent,
  "payment_intent.payment_failed": paymentIntent,
  "payment_intent.processing": paymentIntent,
  "payment_intent.canceled": paymentIntent,

  async "setup_intent.succeeded"({ db, stripe, tenantId, event, account }) {
    const si = event.data.object as Stripe.SetupIntent;
    let pm = typeof si.payment_method === "object" ? si.payment_method : null;
    const pmId = idOf(si.payment_method);
    if (!pm && pmId && stripe) pm = await stripe.paymentMethods.retrieve(pmId, {}, { stripeAccount: account });
    if (!pm) return "payment method details unavailable (Stripe not configured); payment_method.attached will record it";
    return recordPaymentMethod(db, tenantId, { ...pm, customer: pm.customer ?? idOf(si.customer) }, si.metadata?.household_id);
  },

  async "setup_intent.setup_failed"({ event }) {
    const si = event.data.object as Stripe.SetupIntent;
    return `setup failed: ${si.last_setup_error?.code ?? "unknown"}`;
  },

  async "payment_method.attached"({ db, tenantId, event }) {
    return recordPaymentMethod(db, tenantId, event.data.object as Stripe.PaymentMethod);
  },

  async "payment_method.updated"({ db, tenantId, event }) {
    const pm = event.data.object as Stripe.PaymentMethod;
    if (!pm.customer) return "payment method is not attached";
    return recordPaymentMethod(db, tenantId, pm);
  },

  async "payment_method.detached"({ db, tenantId, event }) {
    const pm = event.data.object as Stripe.PaymentMethod;
    const { error } = await db.from("payment_methods").update({ status: "detached", is_default: false }).eq("tenant_id", tenantId).eq("stripe_payment_method_id", pm.id);
    if (error) throw new Error(error.message);
    return `payment method ${pm.id} detached`;
  },

  async "charge.refunded"({ db, tenantId, event }) {
    const charge = event.data.object as Stripe.Charge;
    const refundId = await rpc(db, "record_charge_refund_for", { p_tenant_id: tenantId, p_charge: asJson(charge) });
    return refundId ? `refund ${refundId} recorded` : "ledger already matches Stripe";
  },

  async "customer.created"({ db, tenantId, event }) {
    const c = event.data.object as Stripe.Customer;
    const hh = c.metadata?.household_id;
    if (!hh || !UUID.test(hh)) return "customer not created by KoryoGraph";
    const { error } = await db.from("households").update({ stripe_customer_id: c.id }).eq("tenant_id", tenantId).eq("id", hh).is("stripe_customer_id", null);
    if (error) throw new Error(error.message);
    return `household ${hh} linked to ${c.id}`;
  },

  async "customer.updated"() {
    return "nothing to sync";
  },

  async "customer.deleted"({ db, tenantId, event }) {
    const c = event.data.object as Stripe.Customer;
    const { data: hh } = await db.from("households").update({ stripe_customer_id: null }).eq("tenant_id", tenantId).eq("stripe_customer_id", c.id).select("id");
    for (const h of hh ?? []) {
      await db.from("payment_methods").update({ status: "detached", is_default: false }).eq("household_id", h.id);
    }
    return `unlinked ${hh?.length ?? 0} household(s)`;
  },

  async "account.updated"({ db, event }) {
    const acct = event.data.object as Stripe.Account;
    const s = accountStatus(acct);
    const { error } = await db.from("tenants").update({ stripe_onboarding_complete: s.complete }).eq("stripe_account_id", acct.id);
    if (error) throw new Error(error.message);
    return `onboarding ${s.complete ? "complete" : "incomplete"}`;
  },
};

async function paymentIntent({ db, tenantId, event }: Parameters<Handler>[0]): Promise<string> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const paymentId = await rpc(db, "record_payment_intent_for", { p_tenant_id: tenantId, p_pi: asJson(pi) });
  return paymentId ? `payment ${paymentId} ${pi.status}` : "not a KoryoGraph payment";
}

/**
 * Applies a verified Stripe event exactly once. The event row is written first (stripe_events primary key =
 * Stripe's event id); an event already processed is acknowledged without side effects, and a failed one is
 * retried when Stripe redelivers it.
 */
export async function processStripeEvent(db: ServiceClient, event: Stripe.Event, deps: { stripe: Stripe | null }): Promise<StripeEventResult> {
  const account = event.account ?? (event.type === "account.updated" ? (event.data.object as Stripe.Account).id : null);
  const log = logger().child({ stripe_event: event.id, type: event.type, account });

  const { error: insErr } = await db.from("stripe_events").upsert(
    { id: event.id, type: event.type, account_id: account, livemode: event.livemode, payload: asJson(event) },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (insErr) throw new Error(insErr.message);
  const { data: row } = await db.from("stripe_events").select("processed_at").eq("id", event.id).single();
  if (row?.processed_at) return { outcome: "duplicate" };

  const finish = async (outcome: StripeEventOutcome, detail: string, error: string | null = null): Promise<StripeEventResult> => {
    await db.from("stripe_events").update({ processed_at: error ? null : new Date().toISOString(), error }).eq("id", event.id);
    return { outcome, detail };
  };

  if (!isHandledEvent(event.type)) return finish("ignored", `unhandled type ${event.type}`);
  const handler = handlers[event.type];
  const tenantId = await tenantForAccount(db, account);
  if (!handler || !tenantId || !account) return finish("ignored", `no tenant for account ${account ?? "(platform)"}`);

  try {
    const detail = await handler({ db, stripe: deps.stripe, tenantId, event, account });
    log.info({ tenant_id: tenantId, detail }, "stripe event processed");
    return await finish("processed", detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ tenant_id: tenantId, err: message }, "stripe event failed");
    return finish("failed", message, message);
  }
}
