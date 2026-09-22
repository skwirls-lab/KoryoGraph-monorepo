import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const RILEY = sid("person:ridgeline:riley-adams");
let programId = "";
const ranks: string[] = [];
const rank = (i: number): string => {
  const r = ranks[i];
  if (!r) throw new Error(`rank ${i} not seeded`);
  return r;
};
let skillA = "";
let skillB = "";
let mayaEnrollment = "";

beforeAll(async () => {
  const [p] = await sql<{ id: string }[]>`
    insert into public.programs (tenant_id, name, slug) values (${R}, 'Test Ladder', ${`test-ladder-${Date.now()}`}) returning id`;
  programId = p?.id ?? "";
  for (const [i, name] of ["White", "Yellow", "Orange"].entries()) {
    const [r] = await sql<{ id: string }[]>`
      insert into public.ranks (tenant_id, program_id, name, position, stripes_max) values (${R}, ${programId}, ${name}, ${i + 1}, 2) returning id`;
    ranks.push(r?.id ?? "");
  }
  const [a] = await sql<{ id: string }[]>`insert into public.skills (tenant_id, program_id, category, name) values (${R}, ${programId}, 'kick', 'Front kick') returning id`;
  const [b] = await sql<{ id: string }[]>`insert into public.skills (tenant_id, program_id, category, name) values (${R}, ${programId}, 'form', 'Taegeuk 1') returning id`;
  skillA = a?.id ?? "";
  skillB = b?.id ?? "";
  await sql`insert into public.rank_requirements (tenant_id, rank_id, min_classes, min_days, requires_instructor_approval) values (${R}, ${rank(1)}, 16, 60, true)`;
  await sql`insert into public.rank_skills (tenant_id, rank_id, skill_id) values (${R}, ${rank(1)}, ${skillA}), (${R}, ${rank(1)}, ${skillB})`;
  const [e] = await sql<{ id: string }[]>`
    insert into public.enrollments (tenant_id, person_id, program_id, current_rank_id, started_at)
    values (${R}, ${MAYA}, ${programId}, ${rank(0)}, current_date - 30) returning id`;
  mayaEnrollment = e?.id ?? "";
  await sql`insert into public.enrollments (tenant_id, person_id, program_id, current_rank_id) values (${R}, ${RILEY}, ${programId}, ${rank(0)})`;
});

afterAll(async () => {
  await sql`delete from public.programs where id = ${programId}`;
  await sql.end();
});

describe("curriculum & progression", () => {
  it("v_enrollment_progress reports next rank, requirements and sign-off counts", async () => {
    const instructor = await seededClaims("instructor@ridgelinetkd.demo");
    await asClaims(instructor, (tx) => tx`select public.sign_off_skill(${mayaEnrollment}, ${skillA}, 90, 'Clean chamber')`);
    const [row] = await asClaims(instructor, (tx) => tx<Record<string, unknown>[]>`
      select current_rank_name, next_rank_name, min_classes, min_days, requires_instructor_approval, required_skills, signed_required_skills, days_since_promotion, instructor_approved
      from public.v_enrollment_progress where enrollment_id = ${mayaEnrollment}`);
    expect(row).toMatchObject({
      current_rank_name: "White", next_rank_name: "Yellow", min_classes: 16, min_days: 60, requires_instructor_approval: true,
      required_skills: 2, signed_required_skills: 1, days_since_promotion: 30, instructor_approved: false,
    });
  });

  it("award_stripe increments up to the rank's maximum", async () => {
    const instructor = await seededClaims("instructor@ridgelinetkd.demo");
    await asClaims(instructor, (tx) => tx`select public.award_stripe(${mayaEnrollment}, 'Great focus')`);
    const [n] = await asClaims(instructor, (tx) => tx<{ n: number }[]>`select public.award_stripe(${mayaEnrollment}) as n`);
    expect(n?.n).toBe(2);
    await expect(asClaims(instructor, (tx) => tx`select public.award_stripe(${mayaEnrollment})`)).rejects.toThrow(/maximum of 2 stripes/);
  });

  it("promote writes history, moves the rank and resets stripes and counters", async () => {
    await sql`update public.enrollments set classes_since_promotion = 20 where id = ${mayaEnrollment}`;
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    await asClaims(owner, (tx) => tx`select public.promote(${mayaEnrollment}, ${rank(1)}, 'Manual promotion — test')`);
    const [e] = await sql<{ current_rank_id: string; stripes: number; classes_since_promotion: number; promoted: boolean }[]>`
      select current_rank_id, stripes, classes_since_promotion, last_promoted_at is not null as promoted from public.enrollments where id = ${mayaEnrollment}`;
    expect(e).toEqual({ current_rank_id: rank(1), stripes: 0, classes_since_promotion: 0, promoted: true });
    const [h] = await sql<{ from_rank_id: string; reason: string }[]>`select from_rank_id, reason from public.promotions where enrollment_id = ${mayaEnrollment}`;
    expect(h).toEqual({ from_rank_id: rank(0), reason: "Manual promotion — test" });
  });

  it("front desk (no ranks.promote) cannot promote; a rank from another program is rejected", async () => {
    const frontDesk = await seededClaims("frontdesk@ridgelinetkd.demo");
    await expect(asClaims(frontDesk, (tx) => tx`select public.promote(${mayaEnrollment}, ${rank(2)})`)).rejects.toMatchObject({ code: "42501" });
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const [other] = await sql<{ id: string }[]>`select id from public.ranks where program_id <> ${programId} and tenant_id = ${R} limit 1`;
    if (other) await expect(asClaims(owner, (tx) => tx`select public.promote(${mayaEnrollment}, ${other.id})`)).rejects.toThrow(/not in this program/);
  });

  it("the Cooper guardian sees Maya's progression but not Riley's", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const rows = await asClaims(parent, (tx) => tx<{ person_id: string }[]>`select person_id from public.v_enrollment_progress where program_id = ${programId}`);
    expect(rows.map((r) => r.person_id)).toEqual([MAYA]);
    const promos = await asClaims(parent, (tx) => tx<{ n: number }[]>`select count(*)::int as n from public.promotions where enrollment_id = ${mayaEnrollment}`);
    expect(promos[0]?.n).toBe(1);
    const curriculum = await asClaims(parent, (tx) => tx<{ n: number }[]>`select count(*)::int as n from public.ranks where program_id = ${programId}`);
    expect(curriculum[0]?.n).toBe(3);
  });
});
