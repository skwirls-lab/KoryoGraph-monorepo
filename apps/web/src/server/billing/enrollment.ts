import "server-only";
import {
  addDaysStr,
  addMonthsStr,
  computeInvoice,
  familyDiscountPct,
  firstInvoiceLines,
  type ComputedInvoice,
  type Coupon,
  type Interval,
  type PlanLike,
} from "@koryo/billing";
import type { z } from "zod";
import { todayIn } from "@/lib/people";
import type { enrollmentQuoteSchema } from "@/lib/validation/billing";
import type { Ctx } from "../context";

type QuoteInput = z.output<typeof enrollmentQuoteSchema>;

export interface PlanRow {
  id: string;
  name: string;
  kind: PlanLike["kind"];
  interval: Interval | null;
  interval_count: number;
  price_cents: number;
  enrollment_fee_cents: number;
  contract_months: number | null;
  term_months: number | null;
  class_pack_size: number | null;
  trial_days: number | null;
  family_discount: { second_pct?: number; third_plus_pct?: number };
  tax_class: string;
  gear_package_product_ids: string[];
  program_ids: string[];
}

export interface GearChoice {
  productId: string;
  productName: string;
  variants: { id: string; size: string }[];
  chosenVariantId: string | null;
}

export interface EnrollmentQuote {
  plan: PlanRow;
  invoice: ComputedInvoice;
  familyPct: number;
  coupon: { id: string; code: string; name: string } | null;
  couponError: string | null;
  startsAt: string;
  billingDay: number;
  nextBillAt: string | null;
  endsAt: string | null;
  contractEndsAt: string | null;
  gear: GearChoice[];
  contract: { templateId: string; name: string; body: string; alreadySigned: boolean } | null;
}

const PLAN_COLUMNS =
  "id, name, kind, interval, interval_count, price_cents, enrollment_fee_cents, contract_months, term_months, class_pack_size, trial_days, family_discount, tax_class, gear_package_product_ids, program_ids";

/** Engine-computed first invoice and everything else the enrollment needs. Never trusts client figures. */
export async function quoteEnrollment(ctx: Ctx, v: QuoteInput): Promise<{ quote: EnrollmentQuote } | { error: string }> {
  const db = ctx.supabase;
  const { data: planData } = await db.from("membership_plans").select(PLAN_COLUMNS).eq("id", v.planId).eq("active", true).maybeSingle();
  if (!planData) return { error: "That plan isn't available." };
  const plan = planData as unknown as PlanRow;

  const { data: member } = await db.from("household_members").select("id").eq("household_id", v.householdId).eq("person_id", v.personId).maybeSingle();
  if (!member) return { error: "This person isn't in that household." };

  // Family discount: rank against the household's other live memberships by full price.
  const { data: existing } = await db
    .from("memberships")
    .select("id, price_override_cents, membership_plans(price_cents)")
    .eq("household_id", v.householdId)
    .in("status", ["active", "trial", "past_due", "on_hold"]);
  const rule = { secondPct: plan.family_discount.second_pct ?? 0, thirdPlusPct: plan.family_discount.third_plus_pct ?? 0 };
  const NEW = "zzz-new"; // sorts after every uuid, so an equal-priced existing membership keeps full price
  const items = [
    ...(existing ?? []).map((m) => ({ id: m.id, priceCents: m.price_override_cents ?? m.membership_plans?.price_cents ?? 0 })),
    { id: NEW, priceCents: plan.price_cents },
  ];
  const familyPct = rule.secondPct || rule.thirdPlusPct ? familyDiscountPct(items, NEW, rule) : 0;

  // Coupon.
  let coupon: EnrollmentQuote["coupon"] = null;
  let couponError: string | null = null;
  const coupons: Coupon[] = [];
  if (v.couponCode) {
    const { data: d } = await db.from("discounts").select("id, code, name, kind, value, applies_to, max_uses, uses, starts_at, ends_at, active").eq("code", v.couponCode).maybeSingle();
    const now = Date.now();
    if (!d || !d.active || !["membership", "invoice"].includes(d.applies_to)) couponError = "That code isn't valid.";
    else if ((d.starts_at && Date.parse(d.starts_at) > now) || (d.ends_at && Date.parse(d.ends_at) < now)) couponError = "That code has expired.";
    else if (d.max_uses !== null && d.uses >= d.max_uses) couponError = "That code has been used up.";
    else {
      coupon = { id: d.id, code: d.code ?? v.couponCode, name: d.name };
      coupons.push({ kind: d.kind as Coupon["kind"], value: d.value });
    }
  }

  // Tax rates by class.
  const { data: rates } = await db.from("tax_rates").select("rate, applies_to");
  const taxRates: Record<string, number> = {};
  for (const r of rates ?? []) for (const cls of r.applies_to) taxRates[cls] = (taxRates[cls] ?? 0) + Number(r.rate);

  const first = firstInvoiceLines(
    { kind: plan.kind, priceCents: plan.price_cents, interval: plan.interval, intervalCount: plan.interval_count, enrollmentFeeCents: plan.enrollment_fee_cents },
    plan.name, v.startsAt, v.billingDay,
  );
  const lines = first.lines.map((l) =>
    l.kind === "membership" ? { ...l, taxClass: plan.tax_class, lineDiscountCents: Math.round((l.unitCents * familyPct) / 100) } : l,
  );
  const invoice = computeInvoice(lines, coupons, taxRates);
  if (familyPct > 0) {
    const m = invoice.lines.find((l) => l.kind === "membership");
    if (m) m.description = `${m.description} · family discount ${familyPct}%`;
  }

  // Gear package: every product needs a size (single-variant products choose themselves).
  const gear: GearChoice[] = [];
  if (plan.gear_package_product_ids.length && ctx.modules.has("retail")) {
    const { data: products } = await db.from("products").select("id, name, product_variants(id, options, active)").in("id", plan.gear_package_product_ids);
    for (const p of products ?? []) {
      const variants = p.product_variants.filter((x) => x.active).map((x) => ({ id: x.id, size: String((x.options as { size?: string })?.size ?? "One size") }));
      const chosen = v.gear[p.id] && variants.some((x) => x.id === v.gear[p.id]) ? (v.gear[p.id] ?? null) : variants.length === 1 ? (variants[0]?.id ?? null) : null;
      gear.push({ productId: p.id, productName: p.name, variants, chosenVariantId: chosen });
    }
    gear.sort((a, b) => plan.gear_package_product_ids.indexOf(a.productId) - plan.gear_package_product_ids.indexOf(b.productId));
  }

  // Contract agreement, when the school has a published contract document.
  let contract: EnrollmentQuote["contract"] = null;
  if (plan.kind === "contract") {
    const { data: t } = await db.from("document_templates").select("id, name, body").eq("kind", "contract").eq("active", true).order("version", { ascending: false }).limit(1).maybeSingle();
    if (t) {
      const { data: sig } = await db.from("signatures").select("id").eq("template_id", t.id).eq("person_id", v.personId).maybeSingle();
      contract = { templateId: t.id, name: t.name, body: t.body, alreadySigned: Boolean(sig) };
    }
  }

  return {
    quote: {
      plan, invoice, familyPct, coupon, couponError, startsAt: v.startsAt, billingDay: v.billingDay,
      nextBillAt: first.nextBillAt,
      endsAt: plan.kind === "paid_in_full" && plan.term_months ? addMonthsStr(v.startsAt, plan.term_months)
        : plan.kind === "trial" && plan.trial_days ? addDaysStr(v.startsAt, plan.trial_days) : null,
      contractEndsAt: plan.kind === "contract" && plan.contract_months ? addMonthsStr(v.startsAt, plan.contract_months) : null,
      gear, contract,
    },
  };
}

export function defaultStart(ctx: Ctx): string {
  return todayIn(ctx.tz);
}
