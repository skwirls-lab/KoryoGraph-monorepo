import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const RILEY = sid("person:ridgeline:riley-adams");
let skillId = "";
let saved: Record<string, unknown>[] = [];
const created: string[] = [];
const fb = { scores: [{ criterion: "Technique", score: 4, note: "Good" }], overall: 4, summary: "Nice work overall.", tips: ["One", "Two", "Three"] };

beforeAll(async () => {
  const [s] = await sql<{ id: string }[]>`select id from skills where tenant_id = ${R} and archived_at is null order by sort limit 1`;
  skillId = s?.id ?? "";
  saved = await sql`select * from consents where person_id in (${MAYA}, ${RILEY}) and kind = 'ai_processing'`;
  await sql`delete from consents where person_id in (${MAYA}, ${RILEY}) and kind = 'ai_processing'`;
});

afterAll(async () => {
  await sql`delete from approval_items where kind = 'vision_feedback' and entity_id = any(${created}::uuid[])`;
  await sql`delete from technique_submissions where id = any(${created}::uuid[])`;
  await sql`delete from consents where person_id in (${MAYA}, ${RILEY}) and kind = 'ai_processing'`;
  for (const c of saved) await sql`insert into consents ${sql(c)}`;
  await sql.end();
});

const path = (person: string) => `${R}/technique/${person}/${randomUUID()}.mp4`;

describe("technique submissions (A11)", () => {
  it("a minor can't consent for themselves; their guardian can", async () => {
    const teen = await seededClaims("student@ridgelinetkd.demo");
    await expect(asClaims(teen, (tx) => tx`insert into consents (tenant_id, person_id, guardian_person_id, kind, granted, method)
      values (${R}, ${RILEY}, ${RILEY}, 'ai_processing', true, 'home')`)).rejects.toMatchObject({ code: "42501" });
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    await expect(asClaims(parent, (tx) => tx`insert into consents (tenant_id, person_id, guardian_person_id, kind, granted, method)
      values (${R}, ${RILEY}, app.person_id(), 'ai_processing', true, 'home')`)).rejects.toMatchObject({ code: "42501" }); // not their family
  });

  it("refuses a clip of a minor until a guardian consents, and only for the family's own students and folder", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const submit = (person: string, p: string, ms = 6000) => asClaims(parent, (tx) => tx<{ id: string }[]>`select public.submit_technique(${person}, ${skillId}, ${p}, ${ms}) as id`);
    await expect(submit(MAYA, path(MAYA))).rejects.toThrow(/consent/);
    await asClaims(parent, (tx) => tx`insert into consents (tenant_id, person_id, guardian_person_id, kind, granted, method) values (${R}, ${MAYA}, app.person_id(), 'ai_processing', true, 'home')`);
    await expect(submit(RILEY, path(RILEY))).rejects.toMatchObject({ code: "42501" });
    await expect(submit(MAYA, path(RILEY))).rejects.toThrow(/upload the clip first/);
    await expect(submit(MAYA, path(MAYA), 90_000)).rejects.toThrow(/60 seconds/);
    const [row] = await submit(MAYA, path(MAYA));
    expect(row?.id).toBeTruthy();
    created.push(row?.id ?? "");
    // The backstop also holds for direct inserts by staff.
    await sql`delete from consents where person_id = ${MAYA} and kind = 'ai_processing'`;
    const staff = await seededClaims("owner@ridgelinetkd.demo");
    await expect(asClaims(staff, (tx) => tx`insert into technique_submissions (tenant_id, person_id, skill_id, video_path) values (${R}, ${MAYA}, ${skillId}, ${path(MAYA)})`)).rejects.toThrow(/consent/);
  });

  it("the family sees feedback only once an instructor releases it; sending back records the reason", async () => {
    // The consent backstop applies to every insert, so the guardian's consent is on record first.
    await sql`insert into consents (tenant_id, person_id, kind, granted, method) values (${R}, ${MAYA}, 'ai_processing', true, 'desk')`;
    const subs = await sql<{ id: string }[]>`insert into technique_submissions (tenant_id, person_id, skill_id, video_path, status)
      values (${R}, ${MAYA}, ${skillId}, ${path(MAYA)}, 'review'), (${R}, ${MAYA}, ${skillId}, ${path(MAYA)}, 'review') returning id`;
    const [s1, s2] = subs.map((x) => x.id);
    created.push(s1 ?? "", s2 ?? "");
    const items = await sql<{ id: string }[]>`insert into approval_items (tenant_id, kind, title, person_id, entity_type, entity_id, payload) values
      (${R}, 'vision_feedback', 'T1', ${MAYA}, 'technique_submission', ${s1 ?? ""}, ${sql.json({ submission_id: s1, person_id: MAYA, skill: "x", feedback: fb })}),
      (${R}, 'vision_feedback', 'T2', ${MAYA}, 'technique_submission', ${s2 ?? ""}, ${sql.json({ submission_id: s2, person_id: MAYA, skill: "x", feedback: fb })}) returning id`;
    await sql`update technique_submissions set approval_item_id = ${items[0]?.id ?? ""} where id = ${s1 ?? ""}`;
    await sql`update technique_submissions set approval_item_id = ${items[1]?.id ?? ""} where id = ${s2 ?? ""}`;

    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const seen = () => asClaims(parent, (tx) => tx<{ id: string; status: string; feedback: unknown; return_reason: string | null }[]>`select id, status, feedback, return_reason from technique_submissions where id in (${s1 ?? ""}, ${s2 ?? ""}) order by id`);
    expect((await seen()).every((r) => r.feedback === null)).toBe(true);
    await expect(asClaims(parent, (tx) => tx`select public.release_technique_feedback(${items[0]?.id ?? ""})`)).rejects.toMatchObject({ code: "42501" });

    const instructor = await seededClaims("instructor@ridgelinetkd.demo");
    await expect(asClaims(instructor, (tx) => tx`select public.release_technique_feedback(${items[0]?.id ?? ""})`)).rejects.toThrow(/approve the feedback first/);
    await asClaims(instructor, (tx) => tx`select public.decide_approval(${items[0]?.id ?? ""}, 'approved')`);
    await asClaims(instructor, (tx) => tx`select public.release_technique_feedback(${items[0]?.id ?? ""})`);
    await asClaims(instructor, (tx) => tx`select public.decide_approval(${items[1]?.id ?? ""}, 'rejected', null, 'Too dark — film in better light')`);

    const after = new Map((await seen()).map((r) => [r.id, r]));
    expect(after.get(s1 ?? "")).toMatchObject({ status: "released", feedback: fb });
    expect(after.get(s2 ?? "")).toMatchObject({ status: "returned", feedback: null, return_reason: "Too dark — film in better light" });
    // Another family sees none of it.
    const teen = await seededClaims("student@ridgelinetkd.demo");
    expect(await asClaims(teen, (tx) => tx`select id from technique_submissions where person_id = ${MAYA}`)).toHaveLength(0);
  });

  it("the review drafts show whether they came from a dev fixture without exposing ai_runs", async () => {
    const [run] = await sql<{ id: string }[]>`insert into ai_runs (tenant_id, task_id, tier, transport, status, input_hash) values (${R}, 'technique_feedback', 'vision', 'fixture', 'ok', 'test') returning id`;
    const [it] = await sql<{ ai_transport: string }[]>`insert into approval_items (tenant_id, kind, title, payload, ai_run_id) values (${R}, 'other', 'T', '{}', ${run?.id ?? ""}) returning ai_transport`;
    expect(it?.ai_transport).toBe("fixture");
    await sql`delete from approval_items where ai_run_id = ${run?.id ?? ""}`;
    await sql`delete from ai_runs where id = ${run?.id ?? ""}`;
  });
});
