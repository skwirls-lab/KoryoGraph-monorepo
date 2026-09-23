import { addDaysStr, addMonthsStr, advancePeriod, computeInvoice, familyDiscountPct, firstInvoiceLines, freezeProration, toUtc, type LineInput } from "@koryo/billing";
import { createHash } from "node:crypto";
import { sid } from "../../lib/ids";
import type { SeedContext } from "../context";
import type { DemoPeople, DemoStudent } from "./people";
import { DAY, insertChunks, isoDate, type Rng } from "./rng";

const T = "ridgeline";
const tid = () => sid(`tenant:${T}`);
const LOC = () => sid(`location:${T}:main`);
const TAX: Record<string, number> = { retail: 0.053 };
const FAIL_RATE = 0.04;
const FLOAT = 30000; // $300 opening float, enough to cover a return on a quiet day

interface Plan {
  key: string;
  id: string;
  name: string;
  kind: "recurring" | "contract" | "paid_in_full" | "class_pack" | "trial";
  interval: "month" | null;
  price: number;
  fee: number;
  termMonths: number | null;
  packSize: number | null;
  trialDays: number | null;
  family: { secondPct: number; thirdPlusPct: number };
  gear: string[];
}

const PLANS: Plan[] = [
  { key: "monthly-unlimited", id: "", name: "Monthly Unlimited", kind: "recurring", interval: "month", price: 16900, fee: 4900, termMonths: null, packSize: null, trialDays: null, family: { secondPct: 10, thirdPlusPct: 20 }, gear: ["dobok", "white-belt"] },
  { key: "twice-weekly", id: "", name: "Twice Weekly", kind: "recurring", interval: "month", price: 13900, fee: 4900, termMonths: null, packSize: null, trialDays: null, family: { secondPct: 10, thirdPlusPct: 20 }, gear: ["dobok", "white-belt"] },
  { key: "black-belt-club", id: "", name: "Black Belt Club (12 months)", kind: "contract", interval: "month", price: 19900, fee: 0, termMonths: null, packSize: null, trialDays: null, family: { secondPct: 10, thirdPlusPct: 20 }, gear: ["dobok", "white-belt", "sparring-set"] },
  { key: "six-month-pif", id: "", name: "Six months paid in full", kind: "paid_in_full", interval: null, price: 89900, fee: 0, termMonths: 6, packSize: null, trialDays: null, family: { secondPct: 0, thirdPlusPct: 0 }, gear: ["dobok", "white-belt"] },
  { key: "ten-class-pack", id: "", name: "10-class pack", kind: "class_pack", interval: null, price: 18000, fee: 0, termMonths: null, packSize: 10, trialDays: null, family: { secondPct: 0, thirdPlusPct: 0 }, gear: [] },
  { key: "two-week-trial", id: "", name: "Two-week trial", kind: "trial", interval: null, price: 2900, fee: 0, termMonths: null, packSize: null, trialDays: 14, family: { secondPct: 0, thirdPlusPct: 0 }, gear: ["dobok"] },
];
for (const p of PLANS) p.id = sid(`plan:${T}:${p.key}`);

// The minimal profile has 3 products; the demo adds these to reach 40 SKUs.
const EXTRA_PRODUCTS = [
  { key: "tee", name: "School T-shirt", category: "apparel", sizes: ["S", "M", "L", "XL"], price: 2200, cost: 800 },
  { key: "hoodie", name: "School hoodie", category: "apparel", sizes: ["S", "M", "L", "XL"], price: 4500, cost: 1900 },
  { key: "focus-mitts", name: "Focus mitts (pair)", category: "sparring_gear", sizes: [""], price: 3400, cost: 1400 },
  { key: "kick-shield", name: "Kicking shield", category: "sparring_gear", sizes: [""], price: 5900, cost: 2600 },
  { key: "mouthguard", name: "Mouthguard", category: "sparring_gear", sizes: ["Youth", "Adult"], price: 900, cost: 250 },
  { key: "bottle", name: "Water bottle", category: "consumables", sizes: [""], price: 1500, cost: 500 },
  { key: "gear-bag", name: "Gear bag", category: "other", sizes: [""], price: 3900, cost: 1600 },
  { key: "foam-nunchaku", name: "Foam nunchaku", category: "weapons", sizes: [""], price: 1800, cost: 600 },
  { key: "bo-staff", name: "Bo staff", category: "weapons", sizes: ["48in", "60in"], price: 2900, cost: 1000 },
  { key: "stickers", name: "Sticker pack", category: "consumables", sizes: [""], price: 500, cost: 100 },
] as const;
const BASE_PRODUCTS = [
  { key: "dobok", name: "Dobok (uniform)", sizes: ["000", "00", "0", "1", "2", "3", "4", "5", "6"], price: 5500 },
  { key: "white-belt", name: "White belt", sizes: ["0", "1", "2", "3", "4", "5", "6", "7"], price: 1000 },
  { key: "sparring-set", name: "Sparring gear set", sizes: ["XS", "S", "M", "L", "XL"], price: 14900 },
] as const;

interface Variant { id: string; productKey: string; name: string; price: number; taxClass: string; }

const ean = (key: string) => {
  const digits = BigInt(`0x${createHash("sha1").update(key).digest("hex").slice(0, 12)}`).toString().padStart(13, "0").slice(-12);
  const sum = [...digits].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return `${digits}${(10 - (sum % 10)) % 10}`;
};

/** Timestamp at a local hour on a date (school in New York; seed dates are local calendar days). */
const at = (date: string, hour: number, minute = 0) => new Date(Date.parse(`${date}T00:00:00Z`) + ((hour + 4) * 60 + minute) * 60_000).toISOString();

export interface MoneyStats { memberships: number; invoices: number; payments: number; failed: number; inDunning: number; posSales: number; skus: number }

export async function seedMoney(ctx: SeedContext, rng: Rng, now: Date, people: DemoPeople): Promise<MoneyStats> {
  const { sql } = ctx;
  const t = tid();
  const today = isoDate(now);
  const start2y = addMonthsStr(`${today.slice(0, 7)}-01`, -24);

  // ------------------------------------------------------------------ products & variants (40 SKUs)
  const productRows: Record<string, unknown>[] = [];
  const variantRows: Record<string, unknown>[] = [];
  const variants: Variant[] = [];
  for (const [i, p] of EXTRA_PRODUCTS.entries()) {
    const pid = sid(`product:${T}:${p.key}`);
    productRows.push({ id: pid, tenant_id: t, name: p.name, category: p.category, tax_class: "retail", sort: 10 + i });
    for (const size of p.sizes) {
      const vid = sid(`variant:${T}:${p.key}:${size || "one"}`);
      variantRows.push({ id: vid, tenant_id: t, product_id: pid, sku: `${p.key.toUpperCase()}${size ? `-${size.toUpperCase()}` : ""}`, barcode: ean(`${p.key}:${size}`), options: size ? { size } : {}, price_cents: p.price, cost_cents: p.cost });
    }
  }
  await insertChunks(sql, "products", productRows);
  await insertChunks(sql, "product_variants", variantRows);
  for (const p of BASE_PRODUCTS) {
    for (const size of p.sizes) {
      await sql`update public.product_variants set barcode = ${ean(`${p.key}:${size}`)} where id = ${sid(`variant:${T}:${p.key}:${size}`)} and barcode is null`;
    }
  }
  const allVariants = await sql<{ id: string; price_cents: number; sku: string; options: { size?: string }; product_key: string; name: string; tax_class: string }[]>`
    select v.id, v.price_cents, v.sku, v.options, p.id as product_key, p.name, p.tax_class from public.product_variants v join public.products p on p.id = v.product_id where v.tenant_id = ${t} order by p.sort, v.sku`;
  for (const v of allVariants) variants.push({ id: v.id, productKey: v.product_key, name: `${v.name}${v.options?.size ? ` (${v.options.size})` : ""}`, price: v.price_cents, taxClass: v.tax_class });

  // ------------------------------------------------------------------ memberships
  const byHousehold = new Map<string, DemoStudent[]>();
  for (const s of people.students) (byHousehold.get(s.householdId) ?? byHousehold.set(s.householdId, []).get(s.householdId))?.push(s);
  const householdIds = [...byHousehold.keys()];
  const cardHouseholds = new Set(householdIds.filter(() => rng.chance(0.72)));
  const pmRows: Record<string, unknown>[] = [];
  const pmOf = new Map<string, string>();
  for (const h of cardHouseholds) {
    const id = sid(`payment_method:${T}:${h}`);
    pmOf.set(h, id);
    pmRows.push({ id, tenant_id: t, household_id: h, stripe_payment_method_id: `pm_demo_${h.slice(0, 8)}`, kind: "card", brand: rng.pick(["visa", "visa", "mastercard", "amex", "discover"]), last4: String(rng.int(1000, 9999)), exp_month: rng.int(1, 12), exp_year: rng.int(2027, 2031), is_default: true });
  }
  await insertChunks(sql, "payment_methods", pmRows);

  interface Mem { id: string; s: DemoStudent; plan: Plan; start: string; end: string | null; billingDay: number; status: string; holdFrom: string | null; holdUntil: string | null }
  const mems: Mem[] = [];
  for (const s of people.students) {
    if (s.status === "trial" && !rng.chance(0.9)) continue;
    const plan = s.status === "trial" ? PLANS[5]! : rng.weighted<Plan>([[PLANS[0]!, 52], [PLANS[1]!, 24], [PLANS[2]!, 12], [PLANS[3]!, 7], [PLANS[4]!, 5]]);
    let start = isoDate(s.start);
    if (start < start2y && plan.kind !== "trial") start = addDaysStr(start2y, rng.int(0, 27)); // billing history starts 2 years back
    const end = s.end ? isoDate(s.end) : null;
    const status = s.status === "active" ? "active" : s.status === "trial" ? "trial" : s.status === "on_hold" ? "on_hold" : "cancelled";
    mems.push({
      id: sid(`membership:${T}:${s.id}`), s, plan, start, end: status === "cancelled" ? end ?? addDaysStr(today, -rng.int(10, 200)) : null,
      billingDay: Math.min(28, Number(start.slice(8, 10))), status,
      holdFrom: status === "on_hold" ? end ?? addDaysStr(today, -rng.int(5, 40)) : null,
      holdUntil: status === "on_hold" ? addDaysStr(end ?? today, 60) : null,
    });
  }
  const liveByHousehold = new Map<string, { id: string; priceCents: number }[]>();
  for (const m of mems) if (m.plan.kind === "recurring" || m.plan.kind === "contract") (liveByHousehold.get(m.s.householdId) ?? liveByHousehold.set(m.s.householdId, []).get(m.s.householdId))?.push({ id: m.id, priceCents: m.plan.price });

  // ------------------------------------------------------------------ invoices, payments
  interface Inv { id: string; household: string; person: string; membership: string | null; issued: string; due: string; periodStart: string | null; periodEnd: string | null; lines: ReturnType<typeof computeInvoice>; source: string; memo?: string }
  const invoices: Inv[] = [];
  const memRows: Record<string, unknown>[] = [];
  const gear: { m: Mem; on: string }[] = [];
  const pushInvoice = (m: Mem, key: string, issued: string, lines: LineInput[], periodStart: string | null, periodEnd: string | null, source: string) => {
    const pct = m.plan.family.secondPct || m.plan.family.thirdPlusPct ? familyDiscountPct(liveByHousehold.get(m.s.householdId) ?? [], m.id, m.plan.family) : 0;
    const withDisc = lines.map((l) => (l.kind === "membership" ? { ...l, lineDiscountCents: Math.round((l.unitCents * pct) / 100), description: pct ? `${l.description} · family discount ${pct}%` : l.description } : l));
    invoices.push({ id: sid(`invoice:${T}:${m.id}:${key}`), household: m.s.householdId, person: m.s.id, membership: m.id, issued, due: issued, periodStart, periodEnd, lines: computeInvoice(withDisc, [], TAX), source });
  };
  for (const m of mems) {
    const p = m.plan;
    const stopAt = m.end && m.end < today ? m.end : today;
    let nextBill: string | null = null;
    let endsAt: string | null = null;
    if (p.kind === "recurring" || p.kind === "contract") {
      const first = firstInvoiceLines({ kind: p.kind, priceCents: p.price, interval: p.interval, intervalCount: 1, enrollmentFeeCents: p.fee }, p.name, m.start, m.billingDay);
      pushInvoice(m, "first", m.start, first.lines, m.start, first.periodEnd, "enrollment");
      let ps = first.nextBillAt as string;
      for (let i = 0; i < 40 && toUtc(ps) <= toUtc(stopAt); i++) {
        const pe = advancePeriod(ps, "month");
        const amount = m.holdFrom ? freezeProration(p.price, ps, pe, m.holdFrom, m.holdUntil ?? pe) : p.price;
        pushInvoice(m, ps, ps, [{ kind: "membership", description: `${p.name} (${ps} – ${addDaysStr(pe, -1)})${amount !== p.price ? " · on hold part of the period" : ""}`, unitCents: amount }], ps, pe, "billing_run");
        ps = pe;
      }
      nextBill = m.status === "cancelled" ? null : ps;
    } else if (p.kind === "paid_in_full") {
      let ps = m.start;
      for (let i = 0; toUtc(ps) <= toUtc(stopAt) && i < 6; i++) {
        pushInvoice(m, `pif:${ps}`, ps, [{ kind: "membership", description: p.name, unitCents: p.price }], ps, addMonthsStr(ps, 6), i === 0 ? "enrollment" : "billing_run");
        endsAt = addMonthsStr(ps, 6);
        ps = endsAt;
      }
    } else {
      pushInvoice(m, "one", m.start, [{ kind: "membership", description: p.name, unitCents: p.price }], m.start, null, "enrollment");
      if (p.kind === "trial") endsAt = addDaysStr(m.start, p.trialDays ?? 14);
    }
    if (p.gear.length) gear.push({ m, on: m.start });
    memRows.push({
      id: m.id, tenant_id: t, household_id: m.s.householdId, person_id: m.s.id, plan_id: p.id, status: m.status, starts_at: m.start,
      ends_at: endsAt, billing_day: p.interval ? m.billingDay : null, next_bill_at: nextBill, hold_from: m.holdFrom, hold_until: m.holdUntil,
      cancel_at: m.status === "cancelled" ? m.end : null, cancel_reason: m.status === "cancelled" ? rng.pick(["Moved away", "Schedule conflict", "Cost", "Lost interest", "Switched sports"]) : null,
      contract_ends_at: p.kind === "contract" ? addMonthsStr(m.start, 12) : null, autopay: pmOf.has(m.s.householdId) && Boolean(p.interval),
      payment_method_id: pmOf.has(m.s.householdId) && p.interval ? pmOf.get(m.s.householdId) : null, class_pack_remaining: p.packSize ? rng.int(0, p.packSize) : null,
      created_at: at(m.start, 17),
    });
  }
  await insertChunks(sql, "memberships", memRows);

  // Payments: most succeed on the due date; 4% fail (older ones recovered by a retry, recent ones in dunning).
  invoices.sort((a, b) => a.issued.localeCompare(b.issued) || a.id.localeCompare(b.id));
  const payRows: Record<string, unknown>[] = [];
  const allocRows: Record<string, unknown>[] = [];
  const invRows: Record<string, unknown>[] = [];
  const lineRows: Record<string, unknown>[] = [];
  const refundRows: Record<string, unknown>[] = [];
  const dunning = new Map<string, { failedOn: string; stage: number; error: string }>();
  let invoiceNo = (await sql<{ value: number }[]>`select coalesce((select value from public.tenant_counters where tenant_id = ${t} and name = 'invoice'), 0)::int as value`)[0]?.value ?? 0;
  let creditNote = (await sql<{ value: number }[]>`select coalesce((select value from public.tenant_counters where tenant_id = ${t} and name = 'credit_note'), 0)::int as value`)[0]?.value ?? 0;
  let failed = 0;
  const suspended = new Set<string>();
  for (const inv of invoices) {
    invoiceNo++;
    const extraLines: { kind: string; description: string; total: number }[] = [];
    const pmId = pmOf.get(inv.household);
    const method = pmId ? "card" : rng.weighted<string>([["cash", 4], ["check", 3], ["external", 1]]);
    const daysAgo = Math.round((toUtc(today) - toUtc(inv.due)) / DAY);
    // Card autopay failures: ~4% of all payments overall; recent ones are still in dunning (stages 1–3).
    const fails = method === "card" && rng.chance(daysAgo >= 0 && daysAgo <= 10 ? 0.3 : FAIL_RATE / 0.72);
    const total = inv.lines.totalCents;
    if (total > 0) {
      if (fails) {
        failed++;
        payRows.push({ id: sid(`payment:${T}:${inv.id}:failed`), tenant_id: t, household_id: inv.household, invoice_id: inv.id, amount_cents: total, method, status: "failed", payment_method_id: pmId ?? null,
          received_at: at(inv.due, 6), failure_code: rng.pick(["insufficient_funds", "card_declined", "expired_card"]), failure_message: "Your card was declined.", memo: "Autopay" });
      }
      const recovered = !fails || daysAgo > 12;
      if (recovered) {
        const payDay = fails ? addDaysStr(inv.due, rng.pick([1, 3, 3, 7])) : inv.due;
        const pid = sid(`payment:${T}:${inv.id}`);
        payRows.push({ id: pid, tenant_id: t, household_id: inv.household, invoice_id: inv.id, amount_cents: total, method, status: "succeeded", payment_method_id: method === "card" ? pmId : null,
          received_at: at(payDay, method === "card" ? 6 : rng.int(16, 19), rng.int(0, 59)), memo: method === "card" ? "Autopay" : null });
        allocRows.push({ id: sid(`allocation:${T}:${inv.id}`), tenant_id: t, payment_id: pid, invoice_id: inv.id, amount_cents: total, created_at: at(payDay, 7) });
        // ~1% get a partial refund documented by a credit note (the invoice is credited by the same amount).
        if (!fails && daysAgo > 20 && rng.chance(0.01)) {
          const amount = Math.min(total, rng.pick([2000, 2500, 5000]));
          creditNote++;
          refundRows.push({ id: sid(`refund:${T}:${inv.id}`), tenant_id: t, payment_id: pid, amount_cents: amount, reason: rng.pick(["Missed classes (injury)", "Billing correction", "Goodwill"]), status: "succeeded", credit_note_number: creditNote, created_at: at(addDaysStr(payDay, 10), 15) });
          extraLines.push({ kind: "adjustment", description: `Credit note CN-${creditNote}`, total: -amount });
          payRows[payRows.length - 1]!.refunded_cents = amount;
          payRows[payRows.length - 1]!.status = "partially_refunded";
          allocRows.push({ id: sid(`allocation:${T}:${inv.id}:refund`), tenant_id: t, payment_id: pid, invoice_id: inv.id, amount_cents: -amount, created_at: at(addDaysStr(payDay, 10), 15) });
        }
      } else {
        const stage = daysAgo >= 7 ? 3 : daysAgo >= 3 ? 2 : daysAgo >= 1 ? 1 : 0;
        dunning.set(inv.id, { failedOn: inv.due, stage, error: "Your card was declined." });
        if (stage === 3 && inv.membership) suspended.add(inv.membership);
      }
    }
    const extraTotal = extraLines.reduce((s, l) => s + l.total, 0);
    const d = dunning.get(inv.id);
    invRows.push({
      id: inv.id, tenant_id: t, household_id: inv.household, person_id: inv.person, membership_id: inv.membership, number: invoiceNo, status: "open",
      issued_at: at(inv.issued, 5), due_at: inv.due, period_start: inv.periodStart, period_end: inv.periodEnd, subtotal_cents: inv.lines.subtotalCents,
      discount_cents: inv.lines.discountCents, tax_cents: inv.lines.taxCents, total_cents: total + extraTotal, source: inv.source,
      dunning_state: d ? { attempts: d.stage || 1, failed_on: d.failedOn, stage: d.stage, last_error: d.error, next_step_on: d.stage < 3 ? addDaysStr(d.failedOn, [1, 3, 7][d.stage] ?? 7) : null } : {},
      created_at: at(inv.issued, 5),
    });
    inv.lines.lines.forEach((l, i) => lineRows.push({
      id: sid(`invoice_line:${T}:${inv.id}:${i}`), tenant_id: t, invoice_id: inv.id, kind: l.kind, description: l.description, quantity: l.quantity, unit_cents: l.unitCents,
      total_cents: l.totalCents, tax_cents: l.taxCents, tax_rate: l.taxRate || null, ref_type: l.kind === "membership" ? "membership" : null, ref_id: l.kind === "membership" ? inv.membership : null,
    }));
    extraLines.forEach((l, i) => lineRows.push({ id: sid(`invoice_line:${T}:${inv.id}:x${i}`), tenant_id: t, invoice_id: inv.id, kind: l.kind, description: l.description, quantity: 1, unit_cents: l.total, total_cents: l.total, tax_cents: 0 }));
  }

  // Memberships in dunning: past_due, suspended at the final step.
  for (const [invId] of dunning) {
    const inv = invoices.find((i) => i.id === invId);
    if (inv?.membership) {
      const row = memRows.find((r) => r.id === inv.membership);
      if (row && row.status === "active") row.status = suspended.has(inv.membership) ? "suspended" : "past_due";
    }
  }

  // ------------------------------------------------------------------ POS history, drawers, returns
  const saleRows: Record<string, unknown>[] = [];
  const saleLineRows: Record<string, unknown>[] = [];
  const tenderRows: Record<string, unknown>[] = [];
  const drawerRows: Record<string, unknown>[] = [];
  const movementRows: Record<string, unknown>[] = [];
  const stock = new Map<string, number>(variants.map((v) => [v.id, 0]));
  const events: { on: string; variant: string; delta: number; reason: string; ref?: string; note?: string }[] = [];
  let receipt = (await sql<{ value: number }[]>`select coalesce((select value from public.tenant_counters where tenant_id = ${t} and name = 'receipt'), 0)::int as value`)[0]?.value ?? 0;
  // The walk-in household may already exist (POS used before seeding): use whichever row is there.
  await sql`insert into public.households (id, tenant_id, name, external_id, notes) values (${sid(`household:${T}:walk-in`)}, ${t}, 'Walk-in sales', 'pos:walk-in', 'System household for POS sales without a customer.') on conflict do nothing`;
  const walkIn = (await sql<{ id: string }[]>`select id from public.households where tenant_id = ${t} and external_id = 'pos:walk-in'`)[0]?.id ?? "";
  const salesDays: string[] = [];
  for (let d = start2y; d < today; d = addDaysStr(d, 1)) if (rng.chance(0.42)) salesDays.push(d);
  let posSales = 0;
  for (const day of salesDays) {
    const drawerId = sid(`drawer:${T}:${day}`);
    const n = rng.weighted<number>([[1, 5], [2, 3], [3, 1]]);
    for (let k = 0; k < n; k++) {
      posSales++;
      const saleId = sid(`pos_sale:${T}:${day}:${k}`);
      const attached = rng.chance(0.55) ? rng.pick(householdIds) : null;
      const items = rng.sample(variants.filter((v) => !v.productKey.includes("sparring") || rng.chance(0.3)), rng.weighted<number>([[1, 6], [2, 3], [3, 1]]));
      const lines = items.map((v) => ({ kind: "product" as const, description: v.name, unitCents: v.price, quantity: rng.chance(0.15) ? 2 : 1, taxClass: v.taxClass, discountable: true, lineDiscountCents: rng.chance(0.08) ? Math.round(v.price * 0.1) : 0 }));
      const c = computeInvoice(lines, [], TAX);
      invoiceNo++;
      receipt++;
      const invId = sid(`invoice:${T}:pos:${saleId}`);
      const hh = attached ?? walkIn;
      const method = rng.weighted<string>([["cash", 55], ["terminal", 38], ["check", 7]]);
      const hour = rng.int(15, 19);
      invRows.push({ id: invId, tenant_id: t, household_id: hh, number: invoiceNo, status: "open", issued_at: at(day, hour), due_at: day, subtotal_cents: c.subtotalCents, discount_cents: c.discountCents, tax_cents: c.taxCents, total_cents: c.totalCents, source: "pos", memo: "Point of sale", created_at: at(day, hour) });
      c.lines.forEach((l, i) => lineRows.push({ id: sid(`invoice_line:${T}:${invId}:${i}`), tenant_id: t, invoice_id: invId, kind: "product", description: l.description, quantity: l.quantity, unit_cents: l.unitCents, total_cents: l.totalCents, tax_cents: l.taxCents, tax_rate: l.taxRate || null, ref_type: "variant", ref_id: items[i]?.id }));
      const pid = sid(`payment:${T}:pos:${saleId}`);
      payRows.push({ id: pid, tenant_id: t, household_id: hh, invoice_id: invId, amount_cents: c.totalCents, method, status: "succeeded", received_at: at(day, hour, 5), memo: "POS" });
      allocRows.push({ id: sid(`allocation:${T}:pos:${saleId}`), tenant_id: t, payment_id: pid, invoice_id: invId, amount_cents: c.totalCents, created_at: at(day, hour, 5) });
      const tendered = method === "cash" ? Math.ceil(c.totalCents / 500) * 500 : c.totalCents;
      saleRows.push({ id: saleId, tenant_id: t, location_id: LOC(), household_id: attached, status: "completed", kind: "sale", subtotal_cents: c.subtotalCents, discount_cents: c.discountCents, tax_cents: c.taxCents, total_cents: c.totalCents, invoice_id: invId, receipt_number: receipt, drawer_id: drawerId, created_at: at(day, hour) });
      tenderRows.push({ id: sid(`pos_tender:${T}:${saleId}`), tenant_id: t, sale_id: saleId, method, amount_cents: tendered, payment_id: pid, change_cents: tendered - c.totalCents, created_at: at(day, hour, 5) });
      c.lines.forEach((l, i) => {
        const lineId = sid(`pos_line:${T}:${saleId}:${i}`);
        saleLineRows.push({ id: lineId, tenant_id: t, sale_id: saleId, variant_id: items[i]?.id, qty: l.quantity, unit_cents: l.unitCents, discount_cents: l.discountCents, tax_cents: l.taxCents, total_cents: l.totalCents, created_at: at(day, hour) });
        events.push({ on: day, variant: items[i]?.id ?? "", delta: -l.quantity, reason: "sale", ref: saleId });
      });
      // ~3% returned a few days later (cash back, restocked, credit note).
      const first = c.lines[0];
      const returnDay = addDaysStr(day, rng.int(1, 6));
      if (first && rng.chance(0.03) && returnDay < today && method === "cash") {
        receipt++;
        creditNote++;
        const retId = sid(`pos_sale:${T}:${day}:${k}:return`);
        const amount = Math.round(first.totalCents / first.quantity);
        const tax = Math.round(first.taxCents / first.quantity);
        saleRows.push({ id: retId, tenant_id: t, location_id: LOC(), household_id: attached, status: "completed", kind: "return", original_sale_id: saleId, subtotal_cents: -(amount - tax), tax_cents: -tax, total_cents: -amount, invoice_id: invId, receipt_number: receipt, drawer_id: sid(`drawer:${T}:${returnDay}`), created_at: at(returnDay, 16) });
        saleLineRows.push({ id: sid(`pos_line:${T}:${retId}`), tenant_id: t, sale_id: retId, variant_id: items[0]?.id, qty: -1, unit_cents: first.unitCents, tax_cents: -tax, total_cents: -amount, original_line_id: sid(`pos_line:${T}:${saleId}:0`), created_at: at(returnDay, 16) });
        tenderRows.push({ id: sid(`pos_tender:${T}:${retId}`), tenant_id: t, sale_id: retId, method: "cash", amount_cents: -amount, change_cents: 0, created_at: at(returnDay, 16) });
        refundRows.push({ id: sid(`refund:${T}:${retId}`), tenant_id: t, payment_id: pid, amount_cents: amount, reason: `Wrong size (return ${receipt})`, status: "succeeded", credit_note_number: creditNote, created_at: at(returnDay, 16) });
        lineRows.push({ id: sid(`invoice_line:${T}:${invId}:return`), tenant_id: t, invoice_id: invId, kind: "adjustment", description: `Returned items (receipt ${receipt})`, quantity: 1, unit_cents: -amount, total_cents: -amount, tax_cents: -tax });
        const inv = invRows[invRows.length - 1]!;
        inv.subtotal_cents = (inv.subtotal_cents as number) - (amount - tax);
        inv.tax_cents = (inv.tax_cents as number) - tax;
        inv.total_cents = (inv.total_cents as number) - amount;
        allocRows.push({ id: sid(`allocation:${T}:pos:${retId}`), tenant_id: t, payment_id: pid, invoice_id: invId, amount_cents: -amount, created_at: at(returnDay, 16) });
        const pay = payRows[payRows.length - 1]!;
        pay.refunded_cents = amount;
        pay.status = amount >= c.totalCents ? "refunded" : "partially_refunded";
        events.push({ on: returnDay, variant: items[0]?.id ?? "", delta: 1, reason: "return", ref: retId, note: "Wrong size" });
      }
    }
  }
  // One drawer per trading day (including days that only had a return); expected = float + net cash.
  const cashByDrawer = new Map<string, number>();
  const saleDrawer = new Map(saleRows.map((r) => [r.id as string, r.drawer_id as string]));
  for (const tr of tenderRows) {
    if (tr.method !== "cash") continue;
    const d = saleDrawer.get(tr.sale_id as string) ?? "";
    cashByDrawer.set(d, (cashByDrawer.get(d) ?? 0) + (tr.amount_cents as number) - (tr.change_cents as number));
  }
  const drawerDays = new Map<string, string>();
  for (const r of saleRows) drawerDays.set(r.drawer_id as string, (r.created_at as string).slice(0, 10));
  for (const [drawerId, day] of drawerDays) {
    const expected = FLOAT + (cashByDrawer.get(drawerId) ?? 0);
    const variance = rng.chance(0.85) ? 0 : rng.pick([-500, -100, 100, 200]);
    drawerRows.push({ id: drawerId, tenant_id: t, location_id: LOC(), opened_at: at(day, 14), opening_cents: FLOAT, closed_at: at(day, 21), expected_cents: expected, closing_cents: expected + variance, variance_cents: variance, created_at: at(day, 14) });
  }

  // Gear kits: delivered (stock out) unless the enrollment is recent.
  const fulfilRows: Record<string, unknown>[] = [];
  const firstVariant = (key: string, prefer?: string) => variants.find((v) => v.productKey === sid(`product:${T}:${key}`) && (!prefer || v.name.endsWith(`(${prefer})`))) ?? variants.find((v) => v.productKey === sid(`product:${T}:${key}`));
  for (const g of gear) {
    const picks = g.m.plan.gear.map((k) => firstVariant(k, k === "dobok" ? rng.pick(["0", "1", "2", "3", "4"]) : k === "white-belt" ? rng.pick(["1", "2", "3", "4"]) : rng.pick(["S", "M", "L"]))).filter((v): v is Variant => Boolean(v));
    const recent = toUtc(g.on) > toUtc(addDaysStr(today, -21));
    const id = sid(`gear:${T}:${g.m.id}`);
    fulfilRows.push({ id, tenant_id: t, household_id: g.m.s.householdId, person_id: g.m.s.id, membership_id: g.m.id, variant_ids: picks.map((v) => v.id),
      sizes: Object.fromEntries(picks.map((v) => [v.name.replace(/ \(.+\)$/, ""), v.name.match(/\((.+)\)$/)?.[1] ?? ""])), status: recent ? rng.pick(["pending", "ready"]) : "delivered",
      delivered_at: recent ? null : at(addDaysStr(g.on, rng.int(0, 7)), 17), created_at: at(g.on, 17) });
    if (!recent) for (const v of picks) events.push({ on: addDaysStr(g.on, 3), variant: v.id, delta: -1, reason: "package", ref: id });
  }

  // Stock over time: opening stock two years ago, and a restock whenever an item would drop below 4.
  // Start from the minimal profile's opening stock only, so a re-run makes the same decisions (determinism).
  const existing = await sql<{ variant_id: string; s: number }[]>`select variant_id, sum(delta)::int as s from public.inventory_movements where tenant_id = ${t} and note = 'Opening stock' group by variant_id`;
  for (const e of existing) stock.set(e.variant_id, e.s);
  events.sort((a, b) => a.on.localeCompare(b.on));
  for (const v of variants) {
    if ((stock.get(v.id) ?? 0) < 12) {
      const qty = 12 - (stock.get(v.id) ?? 0);
      movementRows.push({ id: sid(`movement:${T}:demo-opening:${v.id}`), tenant_id: t, variant_id: v.id, location_id: LOC(), delta: qty, reason: "receive", note: "Opening stock (two years ago)", created_at: at(start2y, 10) });
      stock.set(v.id, 12);
    }
  }
  let restocks = 0;
  for (const e of events) {
    const cur = stock.get(e.variant) ?? 0;
    if (e.delta < 0 && cur + e.delta < 4) {
      restocks++;
      movementRows.push({ id: sid(`movement:${T}:restock:${restocks}`), tenant_id: t, variant_id: e.variant, location_id: LOC(), delta: 12, reason: "receive", note: "Restock from Dojo Supply Co.", created_at: at(addDaysStr(e.on, -1), 11) });
      stock.set(e.variant, cur + 12);
    }
    stock.set(e.variant, (stock.get(e.variant) ?? 0) + e.delta);
    movementRows.push({ id: sid(`movement:${T}:${e.reason}:${e.ref}:${e.variant}:${e.delta}`), tenant_id: t, variant_id: e.variant, location_id: LOC(), delta: e.delta, reason: e.reason, ref_type: e.reason === "package" ? "gear_fulfilment" : "pos_sale", ref_id: e.ref, note: e.note ?? null, created_at: at(e.on, 18) });
  }

  // Credits: goodwill on a few households.
  const creditRows = rng.sample(householdIds, Math.round(householdIds.length * 0.05)).map((h) => ({
    id: sid(`credit:${T}:${h}`), tenant_id: t, household_id: h, amount_cents: rng.pick([1000, 2500, 5000]), reason: rng.pick(["Goodwill", "Referral reward", "Makeup for cancelled class"]), source_ref: "demo", created_at: at(addDaysStr(today, -rng.int(5, 200)), 12),
  })).map((c) => ({ ...c, remaining_cents: c.amount_cents }));

  // ------------------------------------------------------------------ write
  for (const r of memRows) if (r.status === "past_due" || r.status === "suspended") await sql`update public.memberships set status = ${r.status as string} where id = ${r.id as string}`;
  await insertChunks(sql, "invoices", invRows);
  await insertChunks(sql, "invoice_lines", lineRows);
  await insertChunks(sql, "payments", payRows);
  await insertChunks(sql, "payment_allocations", allocRows);
  await insertChunks(sql, "refunds", refundRows);
  await insertChunks(sql, "credits", creditRows);
  await insertChunks(sql, "cash_drawers", drawerRows);
  await insertChunks(sql, "pos_sales", saleRows.filter((s) => s.kind === "sale"));
  await insertChunks(sql, "pos_sales", saleRows.filter((s) => s.kind === "return"));
  await insertChunks(sql, "pos_sale_lines", saleLineRows);
  await insertChunks(sql, "pos_tenders", tenderRows);
  await insertChunks(sql, "gear_fulfilments", fulfilRows);
  await insertChunks(sql, "inventory_movements", movementRows);
  for (const [name, value] of [["invoice", invoiceNo], ["credit_note", creditNote], ["receipt", receipt]] as const) {
    await sql`insert into public.tenant_counters (tenant_id, name, value) values (${t}, ${name}, ${value}) on conflict (tenant_id, name) do update set value = greatest(public.tenant_counters.value, excluded.value)`;
  }
  return { memberships: memRows.length, invoices: invRows.length, payments: payRows.length, failed, inDunning: dunning.size, posSales, skus: variants.length };
}

/** Derived money state the disabled triggers would have maintained. */
export async function recomputeMoney(ctx: SeedContext): Promise<void> {
  const { sql } = ctx;
  const t = tid();
  await sql`
    update public.invoices i set paid_cents = a.paid, balance_cents = greatest(i.total_cents - a.paid, 0),
      status = app.invoice_status_for(i.status, i.total_cents, a.paid, i.due_at, a.had, app.tenant_today(i.tenant_id))
    from (select inv.id, coalesce(sum(pa.amount_cents), 0)::int as paid, coalesce(bool_or(pa.amount_cents > 0), false) as had
          from public.invoices inv left join public.payment_allocations pa on pa.invoice_id = inv.id where inv.tenant_id = ${t} group by inv.id) a
    where i.id = a.id`;
  await sql`select app.recompute_household_balance(id) from public.households where tenant_id = ${t}`;
  await sql`
    insert into public.inventory_levels (tenant_id, variant_id, location_id, on_hand, reorder_point)
    select tenant_id, variant_id, location_id, sum(delta)::int, 4 from public.inventory_movements where tenant_id = ${t} group by tenant_id, variant_id, location_id
    on conflict (variant_id, location_id) do update set on_hand = excluded.on_hand, reorder_point = greatest(public.inventory_levels.reorder_point, excluded.reorder_point)`;
}
