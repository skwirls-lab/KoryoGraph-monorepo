import { sid } from "../lib/ids";
import type { SeedContext } from "./context";

interface PlanSpec {
  key: string;
  name: string;
  description: string;
  kind: "recurring" | "paid_in_full" | "contract" | "drop_in" | "class_pack" | "trial";
  interval?: "week" | "month" | "year";
  price: number;
  enrollmentFee?: number;
  contractMonths?: number;
  etf?: number;
  termMonths?: number;
  packSize?: number;
  trialDays?: number;
  classesPerWeek?: number | null;
  family?: [number, number];
  gear?: string[];
  isPublic?: boolean;
}

const PRODUCTS = [
  { key: "dobok", name: "Dobok (uniform)", category: "uniforms", sizes: ["000", "00", "0", "1", "2", "3", "4", "5", "6"], price: 5500, cost: 2200 },
  { key: "white-belt", name: "White belt", category: "belts", sizes: ["0", "1", "2", "3", "4", "5", "6", "7"], price: 1000, cost: 250 },
  { key: "sparring-set", name: "Sparring gear set", category: "sparring_gear", sizes: ["XS", "S", "M", "L", "XL"], price: 14900, cost: 6800 },
] as const;

const PLANS: PlanSpec[] = [
  { key: "monthly-unlimited", name: "Monthly Unlimited", description: "Unlimited classes, billed monthly.", kind: "recurring", interval: "month", price: 16900, enrollmentFee: 4900, family: [10, 20], gear: ["dobok", "white-belt"], isPublic: true },
  { key: "twice-weekly", name: "Twice Weekly", description: "Two classes a week, billed monthly.", kind: "recurring", interval: "month", price: 13900, enrollmentFee: 4900, classesPerWeek: 2, family: [10, 20], gear: ["dobok", "white-belt"], isPublic: true },
  { key: "black-belt-club", name: "Black Belt Club (12 months)", description: "12-month agreement, sparring gear included.", kind: "contract", interval: "month", price: 19900, contractMonths: 12, etf: 30000, family: [10, 20], gear: ["dobok", "white-belt", "sparring-set"] },
  { key: "six-month-pif", name: "Six months paid in full", description: "Unlimited classes for six months, one payment.", kind: "paid_in_full", price: 89900, termMonths: 6, gear: ["dobok", "white-belt"] },
  { key: "ten-class-pack", name: "10-class pack", description: "Ten classes, use any time within 6 months.", kind: "class_pack", price: 18000, packSize: 10 },
  { key: "two-week-trial", name: "Two-week trial", description: "Two weeks of classes and a uniform.", kind: "trial", price: 2900, trialDays: 14, gear: ["dobok"], isPublic: true },
];

/** Ridgeline's billing catalogue: tax rate, products used by gear packages, membership plans, a coupon, dunning. */
export async function seedBillingCatalog(ctx: SeedContext): Promise<void> {
  const { sql } = ctx;
  const t = sid("tenant:ridgeline");

  await sql`insert into public.tax_rates (id, tenant_id, name, rate, applies_to) values (${sid("tax:ridgeline:va")}, ${t}, 'Virginia sales tax', 0.053, ${["retail"]}) on conflict (id) do nothing`;

  const productIds: Record<string, string> = {};
  for (const [i, p] of PRODUCTS.entries()) {
    const pid = sid(`product:ridgeline:${p.key}`);
    productIds[p.key] = pid;
    await sql`insert into public.products (id, tenant_id, name, category, tax_class, sort) values (${pid}, ${t}, ${p.name}, ${p.category}, 'retail', ${i}) on conflict (id) do nothing`;
    for (const size of p.sizes) {
      await sql`insert into public.product_variants (id, tenant_id, product_id, sku, options, price_cents, cost_cents)
        values (${sid(`variant:ridgeline:${p.key}:${size}`)}, ${t}, ${pid}, ${`${p.key.toUpperCase()}-${size}`}, ${sql.json({ size })}, ${p.price}, ${p.cost})
        on conflict (id) do nothing`;
    }
  }

  for (const [i, p] of PLANS.entries()) {
    await sql`insert into public.membership_plans (id, tenant_id, name, description, kind, interval, price_cents, enrollment_fee_cents,
        contract_months, early_termination_fee_cents, term_months, class_pack_size, trial_days, program_ids, attendance_rule,
        family_discount, gear_package_product_ids, public, sort)
      values (${sid(`plan:ridgeline:${p.key}`)}, ${t}, ${p.name}, ${p.description}, ${p.kind}, ${p.interval ?? null}, ${p.price}, ${p.enrollmentFee ?? 0},
        ${p.contractMonths ?? null}, ${p.etf ?? null}, ${p.termMonths ?? null}, ${p.packSize ?? null}, ${p.trialDays ?? null},
        ${[]}, ${sql.json(p.classesPerWeek ? { unlimited: false, classes_per_week: p.classesPerWeek } : { unlimited: true })},
        ${sql.json({ second_pct: p.family?.[0] ?? 0, third_plus_pct: p.family?.[1] ?? 0 })},
        ${(p.gear ?? []).map((g) => productIds[g] ?? "")}, ${p.isPublic ?? false}, ${i * 10})
      on conflict (id) do nothing`;
  }

  await sql`insert into public.discounts (id, tenant_id, code, name, kind, value, applies_to)
    values (${sid("discount:ridgeline:welcome10")}, ${t}, 'WELCOME10', 'Welcome 10% off first month', 'pct', 10, 'membership') on conflict (id) do nothing`;
  await sql`insert into public.dunning_policies (id, tenant_id, name, steps, is_default)
    values (${sid("dunning:ridgeline:default")}, ${t}, 'Standard', ${sql.json([{ day: 1, actions: ["retry", "email"] }, { day: 3, actions: ["retry", "email", "sms"] }, { day: 7, actions: ["retry", "email", "sms", "suspend"] }])}, true)
    on conflict (id) do nothing`;
  ctx.log(`billing catalogue: ${PLANS.length} plans, ${PRODUCTS.length} products (ridgeline)`);
}

/** Demo profile: give the plans access to the demo school's programs (the minimal profile has none). */
export async function linkDemoPlanPrograms(ctx: SeedContext): Promise<void> {
  const { sql } = ctx;
  const t = sid("tenant:ridgeline");
  const ids = async (slugs: string[]) => (await sql<{ id: string }[]>`select id from public.programs where tenant_id = ${t} and slug = any(${slugs}) order by sort`).map((r) => r.id);
  const main = await ids(["little-tigers", "youth-tkd", "adult-tkd"]);
  const withTeam = await ids(["little-tigers", "youth-tkd", "adult-tkd", "sparring-team"]);
  for (const key of ["monthly-unlimited", "twice-weekly", "six-month-pif", "ten-class-pack", "two-week-trial"]) {
    await sql`update public.membership_plans set program_ids = ${main} where id = ${sid(`plan:ridgeline:${key}`)}`;
  }
  await sql`update public.membership_plans set program_ids = ${withTeam} where id = ${sid("plan:ridgeline:black-belt-club")}`;
}
