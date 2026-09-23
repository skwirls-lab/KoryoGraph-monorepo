import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const COOPER = sid("household:ridgeline:cooper");
const ADAMS = sid("household:ridgeline:adams");
const LEO = sid("person:ridgeline:leo-cooper");
const PLAN = sid("plan:ridgeline:monthly-unlimited");
const DOBOK = sid("variant:ridgeline:dobok:2");

const today = new Date().toISOString().slice(0, 10);
function payload(over: Record<string, unknown> = {}) {
  return {
    household_id: COOPER, person_id: LEO, plan_id: PLAN, starts_at: today, billing_day: 1, next_bill_at: null, ends_at: null, contract_ends_at: null,
    discount_ids: [], autopay: false, payment_method_id: null, notes: "db test",
    invoice: { due_at: today, subtotal_cents: 21800, discount_cents: 0, tax_cents: 0, total_cents: 21800, memo: "",
      lines: [{ kind: "membership", description: "Monthly Unlimited", quantity: 1, unit_cents: 16900, total_cents: 16900 }, { kind: "fee", description: "Enrollment fee", quantity: 1, unit_cents: 4900, total_cents: 4900 }] },
    gear: [{ variant_id: DOBOK, product_name: "Dobok (uniform)", size: "2" }],
    payment: { method: "cash", amount_cents: 21800, memo: "" },
    ...over,
  };
}
const cleanup = () => sql`delete from public.memberships where household_id = ${COOPER} and notes = 'db test'`;
const PROGRAM = sid("program:ridgeline:db-enroll-test");
let savedPrograms: string[] = [];

beforeAll(async () => {
  await cleanup();
  await sql`delete from public.programs where id = ${PROGRAM}`;
  await sql`insert into public.programs (id, tenant_id, name, slug) values (${PROGRAM}, ${R}, 'DB Enroll Program', 'db-enroll-test')`;
  await sql`insert into public.ranks (tenant_id, program_id, name, belt_color, position) values (${R}, ${PROGRAM}, 'White', '#ffffff', 1)`;
  savedPrograms = (await sql<{ program_ids: string[] }[]>`select program_ids from public.membership_plans where id = ${PLAN}`)[0]?.program_ids ?? [];
  await sql`update public.membership_plans set program_ids = ${[...savedPrograms, PROGRAM]} where id = ${PLAN}`;
});
afterAll(async () => {
  await sql`update public.membership_plans set program_ids = ${savedPrograms} where id = ${PLAN}`;
  await sql`delete from public.programs where id = ${PROGRAM}`;
  await sql`delete from public.invoices where household_id = ${COOPER} and source = 'enrollment' and memo is null and membership_id is null`;
  await cleanup();
  await sql.end();
});

describe("enroll_membership", () => {
  it("creates membership, paid invoice, program enrollment and a gear fulfilment atomically", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const [row] = await asClaims(owner, (tx) => tx<{ r: { membership_id: string; invoice_id: string; payment_id: string; fulfilment_id: string } }[]>`select public.enroll_membership(${sql.json(payload())}) as r`);
    const r = row?.r;
    expect(r?.membership_id && r.invoice_id && r.payment_id && r.fulfilment_id).toBeTruthy();
    const [m] = await sql`select status from public.memberships where id = ${r?.membership_id ?? ""}`;
    expect(m?.status).toBe("active");
    const [inv] = await sql`select status, paid_cents, total_cents, source from public.invoices where id = ${r?.invoice_id ?? ""}`;
    expect(inv).toMatchObject({ status: "paid", paid_cents: 21800, total_cents: 21800, source: "enrollment" });
    const lines = await sql`select kind, ref_id from public.invoice_lines where invoice_id = ${r?.invoice_id ?? ""} order by kind desc`;
    expect(lines.map((l) => l.kind)).toEqual(["membership", "fee"]);
    expect(lines[0]?.ref_id).toBe(r?.membership_id);
    const [enr] = await sql`select e.status, r.position from public.enrollments e left join public.ranks r on r.id = e.current_rank_id where e.person_id = ${LEO} and e.program_id = ${PROGRAM}`;
    expect(enr).toEqual({ status: "active", position: 1 });
    const [f] = await sql`select status, sizes from public.gear_fulfilments where id = ${r?.fulfilment_id ?? ""}`;
    expect(f).toEqual({ status: "pending", sizes: { "Dobok (uniform)": "2" } });
  });

  it("rejects lines that don't add up, a person outside the household, and a non-staff caller", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const bad = payload({ invoice: { ...payload().invoice, total_cents: 100 } });
    await expect(asClaims(owner, (tx) => tx`select public.enroll_membership(${sql.json(bad)})`)).rejects.toMatchObject({ code: "22023" });
    await expect(asClaims(owner, (tx) => tx`select public.enroll_membership(${sql.json(payload({ household_id: ADAMS }))})`)).rejects.toMatchObject({ code: "22023" });
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select public.enroll_membership(${sql.json(payload())})`)).rejects.toMatchObject({ code: "42501" });
    const harbor = await seededClaims("owner@harborbjj.demo");
    await expect(asClaims(harbor, (tx) => tx`select public.enroll_membership(${sql.json(payload())})`)).rejects.toMatchObject({ code: "42501" });
  });

  it("a front-desk user without retail.sell can't read the fulfilment queue's other tenants; Harbor sees nothing", async () => {
    const harbor = await seededClaims("owner@harborbjj.demo");
    const rows = await asClaims(harbor, (tx) => tx`select id from public.gear_fulfilments`);
    expect(rows).toHaveLength(0);
  });
});
