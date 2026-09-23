import { afterAll, describe, expect, it } from "vitest";
import type { Ctx } from "@/server/context";
import { testingRoster } from "@/server/testing/roster";
import { sid } from "../../scripts/lib/ids";
import { signIn, sql } from "../db/harness";

// M3.01: the testing auto-roster (eligibility engine over v_enrollment_progress) matches SQL truth on the demo seed.
const R = sid("tenant:ridgeline");

afterAll(async () => {
  await sql.end();
});

describe("testing auto-roster on the demo seed", () => {
  it("'eligible' is exactly the students who meet every requirement of their next rank", async () => {
    const owner = await signIn("owner@ridgelinetkd.demo", "KoryoDemo!2026");
    const programs = await sql<{ id: string }[]>`select id from programs where tenant_id = ${R} and active`;
    const ctx = { supabase: owner.client } as unknown as Ctx;
    const roster = await testingRoster(ctx, { id: "00000000-0000-0000-0000-000000000000", program_ids: programs.map((p) => p.id) });
    const engine = new Set(roster.filter((c) => c.eligibility.status === "eligible").map((c) => c.enrollmentId));

    const truth = await sql<{ id: string }[]>`
      select e.id from enrollments e
      join v_enrollment_progress v on v.enrollment_id = e.id
      where e.tenant_id = ${R} and e.status = 'active' and e.program_id = any(${programs.map((p) => p.id)}) and v.next_rank_id is not null
        and v.classes_since_promotion >= coalesce(v.min_classes, 0)
        and v.days_since_promotion >= coalesce(v.min_days, 0)
        and not exists (select 1 from rank_skills rs where rs.rank_id = v.next_rank_id and rs.required
                        and not exists (select 1 from skill_signoffs so where so.enrollment_id = e.id and so.skill_id = rs.skill_id))
        and (not coalesce(v.requires_instructor_approval, false) or coalesce(v.instructor_approved, false))`;
    expect(engine.size).toBeGreaterThan(5);
    expect([...engine].sort()).toEqual(truth.map((t) => t.id).sort());
    // "Almost" students have gaps listed, and nobody listed as eligible has any.
    for (const c of roster) {
      if (c.eligibility.status === "eligible") expect(c.eligibility.gaps).toHaveLength(0);
      if (c.eligibility.status === "almost") expect(c.eligibility.gaps.length).toBeGreaterThan(0);
    }
    expect(roster.some((c) => c.eligibility.status === "almost")).toBe(true);
  });
});
