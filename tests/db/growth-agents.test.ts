import { afterAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const WEEK = "2020-01-06";

afterAll(async () => {
  await sql`delete from home_updates where week_of in (${WEEK}, '2020-01-13')`;
  await sql.end();
});

describe("home updates (A9)", () => {
  it("a family sees only its own students' updates; only ai.approve publishes", async () => {
    const [other] = await sql<{ id: string }[]>`
      select p.id from people p where p.tenant_id = ${R} and p.id <> ${MAYA} and p.dob > current_date - interval '18 years'
        and not exists (select 1 from household_members hm join household_members hm2 on hm2.household_id = hm.household_id where hm.person_id = p.id and hm2.person_id = ${MAYA}) limit 1`;
    await sql`insert into home_updates (tenant_id, person_id, week_of, body) values (${R}, ${MAYA}, ${WEEK}, 'Maya update'), (${R}, ${other?.id ?? ""}, ${WEEK}, 'Other update')`;

    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const seen = await asClaims(parent, (tx) => tx<{ body: string }[]>`select body from home_updates where week_of = ${WEEK}`);
    expect(seen.map((r) => r.body)).toEqual(["Maya update"]);
    await expect(asClaims(parent, (tx) => tx`update home_updates set body = 'forged' where person_id = ${MAYA} and week_of = ${WEEK} returning id`)).resolves.toHaveLength(0);
    await expect(asClaims(parent, (tx) => tx`insert into home_updates (tenant_id, person_id, week_of, body) values (${R}, ${MAYA}, '2020-01-13', 'forged')`)).rejects.toMatchObject({ code: "42501" });

    // Front desk reads people but holds no ai.approve (instructors do: they approve their own action boards).
    const desk = await seededClaims("frontdesk@ridgelinetkd.demo");
    expect(await asClaims(desk, (tx) => tx`select id from home_updates where week_of = ${WEEK}`)).toHaveLength(2);
    await expect(asClaims(desk, (tx) => tx`insert into home_updates (tenant_id, person_id, week_of, body) values (${R}, ${MAYA}, '2020-01-13', 'x')`)).rejects.toMatchObject({ code: "42501" });
  });

  it("pre-rendered sends are service-only", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    await expect(asClaims(owner, (tx) => tx`select public.queue_prerendered(${R}, ${[MAYA]}::uuid[], array['email'], 's', 'b', 'invoice', null)`)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("schedule suggestions (A12)", () => {
  it("stats are service-only; suggestions are for schedule managers", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    await expect(asClaims(owner, (tx) => tx`select * from public.schedule_stats(${R}, 4)`)).rejects.toMatchObject({ code: "42501" });
    const [t] = await sql<{ id: string }[]>`select id from class_templates where tenant_id = ${R} limit 1`;
    await sql`insert into schedule_suggestions (tenant_id, week_of, kind, template_id, title, rationale) values (${R}, ${WEEK}, 'move', ${t?.id ?? ""}, 'T', 'R')`;
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    expect(await asClaims(parent, (tx) => tx`select id from schedule_suggestions where week_of = ${WEEK}`)).toHaveLength(0);
    expect(await asClaims(owner, (tx) => tx`select id from schedule_suggestions where week_of = ${WEEK}`)).toHaveLength(1);
    await sql`delete from schedule_suggestions where week_of = ${WEEK}`;
  });
});
