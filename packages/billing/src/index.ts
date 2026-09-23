/**
 * KoryoGraph billing engine (F7.1–F7.5). Pure functions over integer cents and calendar dates; no I/O.
 * Rounding: half away from zero at each step that produces cents (Math.round on non-negative values).
 */
import { addDaysStr, addMonthsStr, daysBetween, toUtc, type DateStr } from "./dates";

export * from "./dates";

export type Interval = "week" | "month" | "year";

// ---------------------------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------------------------

/** Start of the period after `start` for a recurring interval. */
export function advancePeriod(start: DateStr, interval: Interval, count = 1): DateStr {
  if (count < 1) throw new Error("interval count must be ≥ 1");
  if (interval === "week") return addDaysStr(start, 7 * count);
  if (interval === "month") return addMonthsStr(start, count);
  return addMonthsStr(start, 12 * count);
}

/** The first billing date on or after `from` that falls on `billingDay` (1–28). */
export function firstBillingDate(from: DateStr, billingDay: number): DateStr {
  if (billingDay < 1 || billingDay > 28) throw new Error("billing day must be 1–28");
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  const candidate = `${y}-${String(m).padStart(2, "0")}-${String(billingDay).padStart(2, "0")}`;
  return d <= billingDay ? candidate : addMonthsStr(candidate, 1);
}

// ---------------------------------------------------------------------------------------------
// Proration
// ---------------------------------------------------------------------------------------------

/** Charge for the part of [periodStart, periodEnd) from `from` onward, by day. */
export function prorate(priceCents: number, periodStart: DateStr, periodEnd: DateStr, from: DateStr): number {
  const total = daysBetween(periodStart, periodEnd);
  if (total <= 0) throw new Error("empty period");
  if (toUtc(from) <= toUtc(periodStart)) return priceCents;
  if (toUtc(from) >= toUtc(periodEnd)) return 0;
  return Math.round((priceCents * daysBetween(from, periodEnd)) / total);
}

/**
 * Mid-cycle plan change: credit the unused part of the old price and charge the rest of the period at the
 * new price. Returns the net (positive = owed, negative = credit).
 */
export function upgradeProration(oldPriceCents: number, newPriceCents: number, periodStart: DateStr, periodEnd: DateStr, changeDate: DateStr): { credit: number; charge: number; net: number } {
  const credit = prorate(oldPriceCents, periodStart, periodEnd, changeDate);
  const charge = prorate(newPriceCents, periodStart, periodEnd, changeDate);
  return { credit, charge, net: charge - credit };
}

/**
 * A freeze/hold inside a period: charge only for active days, plus an optional flat hold fee.
 * Hold dates are inclusive of from, exclusive of until.
 */
export function freezeProration(priceCents: number, periodStart: DateStr, periodEnd: DateStr, holdFrom: DateStr, holdUntil: DateStr, holdFeeCents = 0): number {
  const total = daysBetween(periodStart, periodEnd);
  if (total <= 0) throw new Error("empty period");
  const s = Math.max(toUtc(holdFrom), toUtc(periodStart));
  const e = Math.min(toUtc(holdUntil), toUtc(periodEnd));
  const heldDays = Math.max(0, Math.round((e - s) / 86_400_000));
  if (heldDays === 0) return priceCents;
  const active = total - heldDays;
  return Math.round((priceCents * active) / total) + holdFeeCents;
}

// ---------------------------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------------------------

export interface FamilyRule {
  secondPct: number;
  thirdPlusPct: number;
}

/**
 * Family discount across a household's memberships in one billing period: the most expensive stays full
 * price, the next gets `secondPct`, every further one `thirdPlusPct`. Returns discount cents by id.
 */
export function familyDiscounts(items: readonly { id: string; priceCents: number }[], rule: FamilyRule): Record<string, number> {
  const sorted = [...items].sort((a, b) => b.priceCents - a.priceCents || a.id.localeCompare(b.id));
  const out: Record<string, number> = {};
  sorted.forEach((it, i) => {
    const pct = i === 0 ? 0 : i === 1 ? rule.secondPct : rule.thirdPlusPct;
    out[it.id] = Math.round((it.priceCents * Math.min(100, Math.max(0, pct))) / 100);
  });
  return out;
}

export interface Coupon {
  kind: "pct" | "amount";
  value: number;
  /** Optional cap on this coupon's discount in cents. */
  maxCents?: number;
}

/**
 * Coupons stack sequentially on the remaining amount (percentages after amounts is the caller's order).
 * No coupon takes the amount below zero; each respects its own cap. Returns total discount.
 */
export function applyCoupons(amountCents: number, coupons: readonly Coupon[]): number {
  let remaining = amountCents;
  for (const c of coupons) {
    let d = c.kind === "pct" ? Math.round((remaining * Math.min(100, Math.max(0, c.value))) / 100) : c.value;
    if (c.maxCents !== undefined) d = Math.min(d, c.maxCents);
    d = Math.min(d, remaining);
    remaining -= d;
  }
  return amountCents - remaining;
}

// ---------------------------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------------------------

export interface LineInput {
  kind: "membership" | "fee" | "product" | "event" | "testing" | "adjustment";
  description: string;
  unitCents: number;
  quantity?: number;
  /** Key into `taxRates`; undefined/"exempt" = no tax. */
  taxClass?: string;
  /** Family/coupon discounts apply only to discountable lines (memberships by default). */
  discountable?: boolean;
  /** Pre-computed discount for this line (e.g. family discount). */
  lineDiscountCents?: number;
}

export interface ComputedLine {
  kind: LineInput["kind"];
  description: string;
  quantity: number;
  unitCents: number;
  grossCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  taxRate: number;
}

export interface ComputedInvoice {
  lines: ComputedLine[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * Lines → subtotal, discounts (line discounts, then invoice coupons spread over discountable lines in
 * proportion), tax per line on the discounted amount, total. Adjustments may be negative.
 */
export function computeInvoice(lines: readonly LineInput[], coupons: readonly Coupon[] = [], taxRates: Readonly<Record<string, number>> = {}): ComputedInvoice {
  const base = lines.map((l) => {
    const quantity = l.quantity ?? 1;
    const gross = l.unitCents * quantity;
    const lineDiscount = Math.min(Math.max(0, l.lineDiscountCents ?? 0), Math.max(0, gross));
    return { l, quantity, gross, lineDiscount };
  });
  const discountable = base.filter((b) => (b.l.discountable ?? b.l.kind === "membership") && b.gross > 0);
  const pool = discountable.reduce((s, b) => s + b.gross - b.lineDiscount, 0);
  const couponTotal = applyCoupons(pool, coupons);
  // Spread the coupon over discountable lines proportionally; the last line absorbs rounding.
  const couponShare = new Map<(typeof base)[number], number>();
  let assigned = 0;
  discountable.forEach((b, i) => {
    const share = i === discountable.length - 1 ? couponTotal - assigned : pool === 0 ? 0 : Math.round((couponTotal * (b.gross - b.lineDiscount)) / pool);
    couponShare.set(b, share);
    assigned += share;
  });
  const out: ComputedLine[] = base.map((b) => {
    const discount = b.lineDiscount + (couponShare.get(b) ?? 0);
    const net = b.gross - discount;
    const rate = b.l.taxClass && b.l.taxClass !== "exempt" ? (taxRates[b.l.taxClass] ?? 0) : 0;
    const tax = net > 0 ? Math.round(net * rate) : 0;
    return { kind: b.l.kind, description: b.l.description, quantity: b.quantity, unitCents: b.l.unitCents, grossCents: b.gross, discountCents: discount, taxCents: tax, totalCents: net + tax, taxRate: rate };
  });
  const subtotal = out.reduce((s, l) => s + l.grossCents, 0);
  const discount = out.reduce((s, l) => s + l.discountCents, 0);
  const tax = out.reduce((s, l) => s + l.taxCents, 0);
  return { lines: out, subtotalCents: subtotal, discountCents: discount, taxCents: tax, totalCents: subtotal - discount + tax };
}

// ---------------------------------------------------------------------------------------------
// Paid-in-full revenue recognition
// ---------------------------------------------------------------------------------------------

/** Monthly recognition schedule for a prepaid amount; the last month absorbs rounding. */
export function recognitionSchedule(amountCents: number, start: DateStr, months: number): { month: DateStr; cents: number }[] {
  if (months < 1) throw new Error("months must be ≥ 1");
  const per = Math.floor(amountCents / months);
  return Array.from({ length: months }, (_, i) => ({ month: addMonthsStr(start, i), cents: i === months - 1 ? amountCents - per * (months - 1) : per }));
}

/** Deferred (not yet earned) revenue on `asOf` for a prepaid amount. */
export function deferredRevenue(amountCents: number, start: DateStr, months: number, asOf: DateStr): number {
  return recognitionSchedule(amountCents, start, months).filter((s) => toUtc(s.month) > toUtc(asOf)).reduce((t, s) => t + s.cents, 0);
}

// ---------------------------------------------------------------------------------------------
// Dunning
// ---------------------------------------------------------------------------------------------

export type DunningAction = "retry" | "email" | "sms" | "suspend";
export interface DunningStep {
  day: number;
  actions: DunningAction[];
}

export const DEFAULT_DUNNING: DunningStep[] = [
  { day: 1, actions: ["retry", "email"] },
  { day: 3, actions: ["retry", "email", "sms"] },
  { day: 7, actions: ["retry", "email", "sms", "suspend"] },
];

/**
 * Which dunning steps are due on `today` for an invoice that first failed on `failedOn`, given the
 * steps already done (by index). Returns the due step indexes in order.
 */
export function dueDunningSteps(steps: readonly DunningStep[], failedOn: DateStr, today: DateStr, doneStages: number): number[] {
  const elapsed = daysBetween(failedOn, today);
  const due: number[] = [];
  steps.forEach((s, i) => {
    if (i >= doneStages && elapsed >= s.day) due.push(i);
  });
  return due;
}

// ---------------------------------------------------------------------------------------------
// Payment allocation
// ---------------------------------------------------------------------------------------------

export interface OpenInvoice {
  id: string;
  balanceCents: number;
  dueAt: DateStr;
}

/** FIFO, oldest due first (ties by id). Leftover becomes a household credit. */
export function allocatePayment(amountCents: number, invoices: readonly OpenInvoice[]): { allocations: { invoiceId: string; cents: number }[]; leftoverCents: number } {
  if (amountCents < 0) throw new Error("amount must be ≥ 0");
  let left = amountCents;
  const allocations: { invoiceId: string; cents: number }[] = [];
  for (const inv of [...invoices].sort((a, b) => toUtc(a.dueAt) - toUtc(b.dueAt) || a.id.localeCompare(b.id))) {
    if (left === 0) break;
    if (inv.balanceCents <= 0) continue;
    const c = Math.min(left, inv.balanceCents);
    allocations.push({ invoiceId: inv.id, cents: c });
    left -= c;
  }
  return { allocations, leftoverCents: left };
}

// ---------------------------------------------------------------------------------------------
// Membership charges for a period
// ---------------------------------------------------------------------------------------------

export interface PlanLike {
  kind: "recurring" | "paid_in_full" | "contract" | "drop_in" | "class_pack" | "trial";
  priceCents: number;
  interval: Interval | null;
  intervalCount: number;
  enrollmentFeeCents: number;
}

/**
 * The first invoice's lines for a new membership: prorated first period (recurring/contract when the start
 * isn't a billing date), the full price for one-off kinds, plus the enrollment fee.
 */
export function firstInvoiceLines(plan: PlanLike, planName: string, start: DateStr, billingDay: number): { lines: LineInput[]; periodStart: DateStr; periodEnd: DateStr | null; nextBillAt: DateStr | null } {
  const lines: LineInput[] = [];
  let periodEnd: DateStr | null = null;
  let nextBillAt: DateStr | null = null;
  if ((plan.kind === "recurring" || plan.kind === "contract") && plan.interval) {
    if (plan.interval === "month") {
      nextBillAt = firstBillingDate(addDaysStr(start, 1), billingDay);
      const fullStart = addMonthsStr(nextBillAt, -plan.intervalCount);
      const amount = prorate(plan.priceCents, fullStart, nextBillAt, start);
      lines.push({ kind: "membership", description: amount === plan.priceCents ? planName : `${planName} (prorated from ${start})`, unitCents: amount });
      periodEnd = nextBillAt;
    } else {
      nextBillAt = advancePeriod(start, plan.interval, plan.intervalCount);
      lines.push({ kind: "membership", description: planName, unitCents: plan.priceCents });
      periodEnd = nextBillAt;
    }
  } else if (plan.kind !== "trial" || plan.priceCents > 0) {
    lines.push({ kind: "membership", description: planName, unitCents: plan.priceCents });
  }
  if (plan.enrollmentFeeCents > 0) lines.push({ kind: "fee", description: "Enrollment fee", unitCents: plan.enrollmentFeeCents, discountable: false });
  return { lines, periodStart: start, periodEnd, nextBillAt };
}
