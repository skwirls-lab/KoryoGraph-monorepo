import { afterAll, describe, expect, it } from "vitest";
import { createSeedContext } from "../../scripts/seed/context";
import { seedDemo } from "../../scripts/seed/demo";
import { sid } from "../../scripts/lib/ids";
import { sql } from "../db/harness";

// Runs after `db:seed --profile demo` (gate step "seed invariants"). Fails if the demo data is absent.
const R = sid("tenant:ridgeline");

afterAll(async () => {
  await sql.end();
});

const counts = async () => {
  const rows = await sql<{ t: string; n: number }[]>`
    select 'people' t, count(*)::int n from people where tenant_id = ${R}
    union all select 'households', count(*)::int from households where tenant_id = ${R}
    union all select 'class_sessions', count(*)::int from class_sessions where tenant_id = ${R}
    union all select 'attendance', count(*)::int from attendance where tenant_id = ${R}
    union all select 'enrollments', count(*)::int from enrollments where tenant_id = ${R}
    union all select 'promotions', count(*)::int from promotions where tenant_id = ${R}
    union all select 'signatures', count(*)::int from signatures where tenant_id = ${R}
    union all select 'memberships', count(*)::int from memberships where tenant_id = ${R}
    union all select 'invoices', count(*)::int from invoices where tenant_id = ${R}
    union all select 'payments', count(*)::int from payments where tenant_id = ${R}
    union all select 'pos_sales', count(*)::int from pos_sales where tenant_id = ${R}
    union all select 'inventory_movements', count(*)::int from inventory_movements where tenant_id = ${R}`;
  return Object.fromEntries(rows.map((r) => [r.t, r.n]));
};

describe("demo seed invariants", () => {
  it("has a realistic school", async () => {
    const c = await counts();
    expect(c.people).toBeGreaterThan(350);
    expect(c.households).toBeGreaterThan(100);
    expect(c.attendance).toBeGreaterThan(15_000);
    expect(c.promotions).toBeGreaterThan(200);
  });

  it("every student belongs to at least one household", async () => {
    const rows = await sql`select p.id from people p where p.tenant_id = ${R} and 'student' = any (p.type_flags)
      and not exists (select 1 from household_members hm where hm.person_id = p.id)`;
    expect(rows).toHaveLength(0);
  });

  it("attendance is only for people enrolled in (or booked into) that session's program, and never in the future", async () => {
    const orphan = await sql`select a.id from attendance a join class_sessions s on s.id = a.session_id where a.tenant_id = ${R}
      and not exists (select 1 from enrollments e where e.person_id = a.person_id and e.program_id = any (s.program_ids))
      and not exists (select 1 from bookings b where b.session_id = s.id and b.person_id = a.person_id)`;
    expect(orphan).toHaveLength(0);
    const future = await sql`select a.id from attendance a join class_sessions s on s.id = a.session_id where a.tenant_id = ${R} and s.starts_at > now()`;
    expect(future).toHaveLength(0);
  });

  it("rank ladders are contiguous (1..n) and enrollments hold ranks of their own program", async () => {
    const gaps = await sql`select program_id from ranks where tenant_id = ${R} group by program_id having max(position) <> count(*) or min(position) <> 1`;
    expect(gaps).toHaveLength(0);
    const wrong = await sql`select e.id from enrollments e join ranks r on r.id = e.current_rank_id where e.tenant_id = ${R} and r.program_id <> e.program_id`;
    expect(wrong).toHaveLength(0);
  });

  it("classes_since_promotion matches attendance since the last promotion", async () => {
    const off = await sql`select e.id from enrollments e where e.tenant_id = ${R} and e.classes_since_promotion <> (
      select count(*) from attendance a join class_sessions s on s.id = a.session_id
      where a.person_id = e.person_id and e.program_id = any (s.program_ids) and s.starts_at >= coalesce(e.last_promoted_at, e.started_at::timestamptz))`;
    expect(off).toHaveLength(0);
  });

  it("the demo accounts' family is in place (Cooper household, 2 kids, PIN set, a decaying student exists)", async () => {
    const kids = await sql`select p.first_name from household_members hm join people p on p.id = hm.person_id where hm.household_id = ${sid("household:ridgeline:cooper")} and hm.relationship = 'student' order by 1`;
    expect(kids.map((k) => k.first_name)).toEqual(["Leo", "Maya"]);
    const [pin] = await sql<{ ok: boolean }[]>`select pin_hash = extensions.crypt('4321', pin_hash) as ok from kiosk_pins where household_id = ${sid("household:ridgeline:cooper")}`;
    expect(pin?.ok).toBe(true);
  });

  it("has two years of money: memberships for students, invoices, payments with ~4% failures, POS, 40 SKUs, dunning", async () => {
    const c = await counts();
    expect(c.memberships).toBeGreaterThan(200);
    expect(c.invoices).toBeGreaterThan(3000);
    expect(c.pos_sales).toBeGreaterThan(300);
    const [skus] = await sql<{ n: number }[]>`select count(*)::int as n from product_variants where tenant_id = ${R}`;
    expect(skus?.n).toBe(40);
    const [f] = await sql<{ failed: number; total: number }[]>`select count(*) filter (where status = 'failed')::int as failed, count(*)::int as total from payments where tenant_id = ${R}`;
    expect((f?.failed ?? 0) / (f?.total ?? 1)).toBeGreaterThan(0.025);
    expect((f?.failed ?? 0) / (f?.total ?? 1)).toBeLessThan(0.06);
    const stages = await sql<{ stage: number }[]>`select distinct stage from v_dunning where tenant_id = ${R} order by 1`;
    expect(stages.map((s) => s.stage)).toEqual(expect.arrayContaining([1, 2, 3]));
    const [susp] = await sql<{ n: number }[]>`select count(*)::int as n from memberships where tenant_id = ${R} and status = 'suspended'`;
    expect(susp?.n).toBeGreaterThan(0);
    const [refunds] = await sql<{ n: number }[]>`select count(*)::int as n from refunds where tenant_id = ${R} and credit_note_number is not null`;
    expect(refunds?.n).toBeGreaterThan(0);
    const [credits] = await sql<{ n: number }[]>`select count(*)::int as n from credits where tenant_id = ${R} and remaining_cents > 0`;
    expect(credits?.n).toBeGreaterThan(0);
    const [kits] = await sql<{ n: number }[]>`select count(*)::int as n from gear_fulfilments where tenant_id = ${R}`;
    expect(kits?.n).toBeGreaterThan(50);
  });

  it("ledger truth: invoice totals = lines, paid/balance/status = allocations, payments' refunds = refund rows", async () => {
    const badTotals = await sql`select i.id from invoices i where i.tenant_id = ${R} and i.total_cents <> (select coalesce(sum(total_cents), 0) from invoice_lines l where l.invoice_id = i.id)`;
    expect(badTotals).toHaveLength(0);
    const badPaid = await sql`select i.id from invoices i where i.tenant_id = ${R} and (
      i.paid_cents <> (select coalesce(sum(amount_cents), 0) from payment_allocations a where a.invoice_id = i.id)
      or i.balance_cents <> greatest(i.total_cents - i.paid_cents, 0)
      or i.status <> app.invoice_status_for(i.status, i.total_cents, i.paid_cents, i.due_at,
           exists (select 1 from payment_allocations a where a.invoice_id = i.id and a.amount_cents > 0), app.tenant_today(i.tenant_id)))`;
    expect(badPaid).toHaveLength(0);
    const badRefunds = await sql`select p.id from payments p where p.tenant_id = ${R} and p.refunded_cents <> (select coalesce(sum(amount_cents), 0) from refunds r where r.payment_id = p.id and r.status = 'succeeded')`;
    expect(badRefunds).toHaveLength(0);
    const badBalance = await sql`select h.id from households h where h.tenant_id = ${R} and h.balance_cents <>
      coalesce((select sum(balance_cents) from invoices where household_id = h.id and status in ('open', 'partially_paid', 'past_due')), 0)
      - coalesce((select sum(remaining_cents) from credits where household_id = h.id and (expires_at is null or expires_at >= app.tenant_today(h.tenant_id))), 0)`;
    expect(badBalance).toHaveLength(0);
  });

  it("dashboard MRR and AR are non-zero and equal the engine over the raw rows", async () => {
    const { monthlyEquivalent } = await import("@koryo/billing");
    const live = await sql<{ price: number; interval: "week" | "month" | "year"; count: number }[]>`
      select coalesce(m.price_override_cents, p.price_cents) as price, p.interval, p.interval_count as count
      from memberships m join membership_plans p on p.id = m.plan_id
      where m.tenant_id = ${R} and m.status in ('active', 'past_due', 'suspended') and p.kind in ('recurring', 'contract')`;
    const engine = live.reduce((s, m) => s + monthlyEquivalent(m.price, m.interval, m.count), 0);
    const [view] = await sql<{ mrr: number }[]>`select coalesce(sum(mrr_cents), 0)::int as mrr from v_mrr where tenant_id = ${R}`;
    expect(engine).toBeGreaterThan(0);
    expect(view?.mrr).toBe(engine);
    const [ar] = await sql<{ view: number; truth: number }[]>`select
      (select coalesce(sum(balance_cents), 0) from v_ar_aging where tenant_id = ${R})::int as view,
      (select coalesce(sum(i.total_cents - (select coalesce(sum(a.amount_cents), 0) from payment_allocations a where a.invoice_id = i.id)), 0)
         from invoices i where i.tenant_id = ${R} and i.status in ('open', 'partially_paid', 'past_due'))::int as truth`;
    expect(ar?.view).toBeGreaterThan(0);
    expect(ar?.view).toBe(ar?.truth);
  });

  it("stock = movement ledger and never negative; drawers balance", async () => {
    const off = await sql`select l.id from inventory_levels l where l.tenant_id = ${R} and l.on_hand <> (select coalesce(sum(delta), 0) from inventory_movements m where m.variant_id = l.variant_id and m.location_id = l.location_id)`;
    expect(off).toHaveLength(0);
    const negative = await sql`select id from inventory_levels where tenant_id = ${R} and on_hand < 0`;
    expect(negative).toHaveLength(0);
    const drawers = await sql`select d.id from cash_drawers d where d.tenant_id = ${R} and d.closed_at is not null and (
      d.expected_cents <> d.opening_cents + coalesce((select sum(t.amount_cents - t.change_cents) from pos_tenders t join pos_sales s on s.id = t.sale_id where s.drawer_id = d.id and t.method = 'cash'), 0)
      or d.variance_cents <> d.closing_cents - d.expected_cents)`;
    expect(drawers).toHaveLength(0);
  });

  it("is deterministic: re-running the demo seed creates no new rows", async () => {
    const before = await counts();
    const ctx = createSeedContext();
    ctx.log = () => undefined;
    try {
      await seedDemo(ctx);
    } finally {
      await ctx.sql.end();
    }
    expect(await counts()).toEqual(before);
  }, 120_000);
});
