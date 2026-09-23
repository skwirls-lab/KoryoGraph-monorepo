import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

// Fixtures live in months no seed uses (2019) and under a unique lead source, so the expected numbers are
// exact; broader checks compare each view with an independent SQL formulation over the whole tenant.
const R = sid("tenant:ridgeline");
const tag = `dbtest-${randomUUID().slice(0, 8)}`;
const people: string[] = [];
let household = "";
let plan = "";
let event = "";
const invoices: string[] = [];

async function person(first: string): Promise<string> {
  const [p] = await sql<{ id: string }[]>`insert into people (tenant_id, first_name, last_name, type_flags, status) values (${R}, ${first}, ${tag}, '{student}', 'active') returning id`;
  await sql`insert into household_members (tenant_id, household_id, person_id, relationship) values (${R}, ${household}, ${p?.id ?? ""}, 'student')`;
  people.push(p?.id ?? "");
  return p?.id ?? "";
}

beforeAll(async () => {
  const [h] = await sql<{ id: string }[]>`insert into households (tenant_id, name) values (${R}, ${`Growth ${tag}`}) returning id`;
  household = h?.id ?? "";
  const [pl] = await sql<{ id: string }[]>`select id from membership_plans where tenant_id = ${R} and kind = 'recurring' limit 1`;
  plan = pl?.id ?? "";
  const stage = async (key: string) => (await sql<{ id: string }[]>`select id from pipeline_stages where tenant_id = ${R} and key = ${key}`)[0]?.id ?? "";
  const at = "2019-03-10 15:00+00";
  for (const [first, key] of [["New", "new"], ["Booked", "trial_scheduled"], ["Offer", "offer"], ["Won", "won"], ["Lost", "lost"], ["Evidence", "new"]] as const) {
    const pid = await person(`Lead${first}`);
    const [l] = await sql<{ id: string }[]>`insert into leads (tenant_id, person_id, stage_id, source, created_at) values (${R}, ${pid}, ${await stage(key)}, ${tag}, ${at}) returning id`;
    if (first === "Evidence") await sql`insert into lead_activities (tenant_id, lead_id, kind, body) values (${R}, ${l?.id ?? ""}, 'trial_attended', 'Attended')`;
  }
  // Retention cohort 2019-01: A stays, B cancels mid-February, C expires in January.
  const [a, b, c] = [await person("CohortA"), await person("CohortB"), await person("CohortC")];
  await sql`insert into memberships (tenant_id, household_id, person_id, plan_id, status, starts_at) values (${R}, ${household}, ${a}, ${plan}, 'active', '2019-01-10')`;
  await sql`insert into memberships (tenant_id, household_id, person_id, plan_id, status, starts_at, cancel_at, cancel_reason) values (${R}, ${household}, ${b}, ${plan}, 'cancelled', '2019-01-12', '2019-02-15', 'Moved away')`;
  await sql`insert into memberships (tenant_id, household_id, person_id, plan_id, status, starts_at, ends_at) values (${R}, ${household}, ${c}, ${plan}, 'expired', '2019-01-05', '2019-01-20')`;
  // Event revenue: two registrations with invoices (one partly paid), one voided invoice that mustn't count.
  const [e] = await sql<{ id: string }[]>`insert into events (tenant_id, kind, name, starts_at, ends_at, pricing) values (${R}, 'seminar', ${`Growth ${tag}`}, '2019-04-01 15:00+00', '2019-04-01 18:00+00', '[]') returning id`;
  event = e?.id ?? "";
  for (const [i, [total, status]] of ([[5000, "open"], [3000, "open"], [9999, "void"]] as const).entries()) {
    const [inv] = await sql<{ id: string }[]>`insert into invoices (tenant_id, household_id, number, status, subtotal_cents, total_cents, balance_cents, source)
      values (${R}, ${household}, app.next_counter(${R}, 'invoice'), ${status}, ${total}, ${total}, ${total}, 'event') returning id`;
    invoices.push(inv?.id ?? "");
    await sql`insert into event_registrations (tenant_id, event_id, person_id, status, invoice_id) values (${R}, ${event}, ${people[i] ?? ""}, ${status === "void" ? "cancelled" : "registered"}, ${inv?.id ?? ""})`;
  }
  const [p] = await sql<{ id: string }[]>`insert into payments (tenant_id, household_id, invoice_id, amount_cents, method, status) values (${R}, ${household}, ${invoices[0] ?? ""}, 2000, 'cash', 'succeeded') returning id`;
  await sql`insert into payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (${R}, ${p?.id ?? ""}, ${invoices[0] ?? ""}, 2000)`;
});

afterAll(async () => {
  await sql`delete from events where id = ${event}`;
  await sql`delete from payments where household_id = ${household}`;
  await sql`delete from invoices where household_id = ${household}`;
  await sql`delete from memberships where household_id = ${household}`;
  await sql`delete from leads where source = ${tag}`;
  await sql`delete from automation_runs where person_id = any(${people}::uuid[])`;
  await sql`delete from communications where person_id = any(${people}::uuid[])`;
  await sql`delete from people where id = any(${people}::uuid[])`;
  await sql`delete from households where id = ${household}`;
  await sql.end();
});

describe("growth reports", () => {
  it("trial funnel counts each step (a later stage implies the earlier ones)", async () => {
    const [f] = await sql`select leads, trials_booked, trials_attended, won, lost from v_trial_funnel where tenant_id = ${R} and source = ${tag} and period = '2019-03'`;
    expect(f).toEqual({ leads: 6, trials_booked: 4, trials_attended: 3, won: 1, lost: 1 });
    // Whole tenant: leads per month equal a plain count.
    const view = await sql<{ n: number }[]>`select coalesce(sum(leads), 0)::int as n from v_trial_funnel where tenant_id = ${R}`;
    const truth = await sql<{ n: number }[]>`select count(*)::int as n from leads where tenant_id = ${R}`;
    expect(view[0]?.n).toBe(truth[0]?.n);
  });

  it("retention cohorts: month-end checkpoints", async () => {
    const rows = await sql<{ month_index: number; cohort_size: number; retained: number }[]>`
      select month_index, cohort_size, retained from v_retention_cohorts where tenant_id = ${R} and cohort = '2019-01' and month_index in (0, 1, 12) order by month_index`;
    // Other 2019-01 starters (none in the seeds) would change the size; the fixture is the whole cohort.
    expect(rows).toEqual([{ month_index: 0, cohort_size: 3, retained: 2 }, { month_index: 1, cohort_size: 3, retained: 1 }, { month_index: 12, cohort_size: 3, retained: 1 }]);
    const [sizes] = await sql<{ n: number }[]>`select coalesce(sum(cohort_size), 0)::int as n from v_retention_cohorts where tenant_id = ${R} and month_index = 0`;
    const [persons] = await sql<{ n: number }[]>`select count(distinct m.person_id)::int as n from memberships m join membership_plans p on p.id = m.plan_id
      where m.tenant_id = ${R} and p.kind in ('recurring', 'contract', 'paid_in_full') and m.status <> 'pending'`;
    expect(sizes?.n).toBe(persons?.n);
  });

  it("churn list: cancelled and expired memberships with reason and tenure", async () => {
    const rows = await sql`select person_name, reason, tenure_months, ended_on::text from v_churn_list where tenant_id = ${R} and person_id = any(${people}::uuid[]) order by person_name`;
    expect(rows).toEqual([
      { person_name: `CohortB ${tag}`, reason: "Moved away", tenure_months: 1, ended_on: "2019-02-15" },
      { person_name: `CohortC ${tag}`, reason: "Expired", tenure_months: 0, ended_on: "2019-01-20" },
    ]);
  });

  it("event revenue: invoiced, paid and outstanding exclude void invoices", async () => {
    const [r] = await sql`select registrations, invoiced_cents, paid_cents, outstanding_cents from v_event_revenue where event_id = ${event}`;
    expect(r).toEqual({ registrations: 2, invoiced_cents: 8000, paid_cents: 2000, outstanding_cents: 6000 });
  });

  it("staff sessions match the schedule, and readers without permission see nothing", async () => {
    const [v] = await sql<{ n: number }[]>`select coalesce(sum(sessions), 0)::int as n from v_staff_sessions where tenant_id = ${R}`;
    const [t] = await sql<{ n: number }[]>`select coalesce(sum(cardinality(case when cardinality(substitute_ids) > 0 then substitute_ids else instructor_ids end)), 0)::int as n
      from class_sessions where tenant_id = ${R} and status <> 'cancelled' and starts_at <= now()`;
    expect(v?.n).toBe(t?.n);
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const seen = await asClaims(parent, (tx) => tx`select 1 from v_trial_funnel union all select 1 from v_churn_list union all select 1 from v_retention_cohorts union all select 1 from v_staff_sessions`);
    expect(seen).toHaveLength(0);
    // Events are visible to members, but the revenue behind them isn't: the parent sees no one else's money.
    const [ev] = await asClaims(parent, (tx) => tx`select registrations, invoiced_cents from v_event_revenue where event_id = ${event}`);
    expect(ev).toEqual({ registrations: 0, invoiced_cents: 0 });
  });
});
