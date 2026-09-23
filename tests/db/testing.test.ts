import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const RILEY = sid("person:ridgeline:riley-adams");
const program = randomUUID();
const ranks = [randomUUID(), randomUUID()];
const event = randomUUID();
const regs: Record<string, string> = {};

beforeAll(async () => {
  await sql`insert into programs (id, tenant_id, name, slug) values (${program}, ${R}, 'DB testing program', ${`db-testing-${program.slice(0, 6)}`})`;
  await sql`insert into ranks (id, tenant_id, program_id, name, belt_color, position) values (${ranks[0] ?? ""}, ${R}, ${program}, 'White', '#ffffff', 1), (${ranks[1] ?? ""}, ${R}, ${program}, 'Yellow', '#facc15', 2)`;
  await sql`insert into testing_events (id, tenant_id, name, starts_at, program_ids, fee_cents) values (${event}, ${R}, 'DB test', now() + interval '7 days', ${[program]}, 4500)`;
  for (const [key, person] of [["maya", MAYA], ["riley", RILEY]] as const) {
    const [e] = await sql<{ id: string }[]>`insert into enrollments (tenant_id, person_id, program_id, current_rank_id) values (${R}, ${person}, ${program}, ${ranks[0] ?? ""}) returning id`;
    const [r] = await sql<{ id: string }[]>`insert into testing_registrations (tenant_id, testing_event_id, enrollment_id, person_id, to_rank_id, status) values (${R}, ${event}, ${e?.id ?? ""}, ${person}, ${ranks[1] ?? ""}, 'invited') returning id`;
    regs[key] = r?.id ?? "";
  }
});

afterAll(async () => {
  await sql`delete from invoices where id in (select invoice_id from testing_registrations where testing_event_id = ${event})`;
  await sql`delete from promotions where testing_event_id = ${event}`;
  await sql`delete from testing_events where id = ${event}`;
  await sql`delete from programs where id = ${program}`;
  await sql.end();
});

describe("testing registrations", () => {
  it("a parent sees and registers only their own students; registering creates the fee invoice", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const visible = await asClaims(parent, (tx) => tx<{ id: string }[]>`select id from testing_registrations where testing_event_id = ${event}`);
    expect(visible.map((v) => v.id)).toEqual([regs.maya]);
    await expect(asClaims(parent, (tx) => tx`select public.register_for_testing(${regs.riley ?? ""})`)).rejects.toMatchObject({ code: "42501" });
    const [r] = await asClaims(parent, (tx) => tx<{ inv: string }[]>`select public.register_for_testing(${regs.maya ?? ""}) as inv`);
    const [inv] = await sql`select source, total_cents, status from invoices where id = ${r?.inv ?? ""}`;
    expect(inv).toEqual({ source: "testing", total_cents: 4500, status: "open" });
    await sql`insert into payments (id, tenant_id, household_id, invoice_id, amount_cents, method, status) select ${randomUUID()}, ${R}, household_id, id, 4500, 'cash', 'succeeded' from invoices where id = ${r?.inv ?? ""}`;
    await sql`insert into payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) select ${R}, p.id, p.invoice_id, 4500 from payments p where p.invoice_id = ${r?.inv ?? ""}`;
    const [reg] = await sql`select status from testing_registrations where id = ${regs.maya ?? ""}`;
    expect(reg?.status).toBe("paid");
  });

  it("only staff with ranks.promote + testing.manage can bulk promote; promotion resets stripes and counters", async () => {
    await sql`update testing_registrations set status = 'passed' where id = ${regs.maya ?? ""}`;
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`select * from public.bulk_promote(${event}, ${[regs.maya ?? ""]})`)).rejects.toMatchObject({ code: "42501" });
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const rows = await asClaims(owner, (tx) => tx<{ registration_id: string }[]>`select * from public.bulk_promote(${event}, ${[regs.maya ?? "", regs.riley ?? ""]})`);
    expect(rows.map((r) => r.registration_id)).toEqual([regs.maya]); // Riley isn't passed
    const [e] = await sql`select e.current_rank_id, e.stripes, e.classes_since_promotion from enrollments e join testing_registrations r on r.enrollment_id = e.id where r.id = ${regs.maya ?? ""}`;
    expect(e).toEqual({ current_rank_id: ranks[1], stripes: 0, classes_since_promotion: 0 });
    const again = await asClaims(owner, (tx) => tx`select * from public.bulk_promote(${event}, ${[regs.maya ?? ""]})`);
    expect(again).toHaveLength(0); // never promoted twice
  });
});
