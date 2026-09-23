import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const ids = [randomUUID(), randomUUID()];

beforeAll(async () => {
  for (const id of ids) {
    await sql`insert into approval_items (id, tenant_id, kind, title, payload, person_id) values (${id}, ${R}, 'drift_outreach', 'DB approval', ${sql.json({ person_id: MAYA, messages: [{ channel: "sms", body: "Hi" }] })}, ${MAYA})`;
  }
});

afterAll(async () => {
  await sql`delete from approval_items where id = any(${ids}::uuid[])`;
  await sql.end();
});

describe("approval decisions", () => {
  it("only ai.approve decides; a parent can't even see the queue", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    expect(await asClaims(parent, (tx) => tx`select id from approval_items`)).toHaveLength(0);
    await expect(asClaims(parent, (tx) => tx`select public.decide_approval(${ids[0] ?? ""}, 'approved')`)).rejects.toMatchObject({ code: "42501" });
    const desk = await seededClaims("frontdesk@ridgelinetkd.demo");
    expect((await asClaims(desk, (tx) => tx`select id from approval_items where id = any(${ids}::uuid[])`)).length).toBe(2);
    await expect(asClaims(desk, (tx) => tx`select public.decide_approval(${ids[0] ?? ""}, 'approved')`)).rejects.toMatchObject({ code: "42501" });
  });

  it("approve stores the edited payload once; reject needs a reason", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const edited = { person_id: MAYA, messages: [{ channel: "sms", body: "Edited" }] };
    await asClaims(owner, (tx) => tx`select public.decide_approval(${ids[0] ?? ""}, 'approved', ${sql.json(edited)})`);
    const [a] = await sql`select status, payload, decided_by is not null as by from approval_items where id = ${ids[0] ?? ""}`;
    expect(a).toEqual({ status: "approved", payload: edited, by: true });
    await expect(asClaims(owner, (tx) => tx`select public.decide_approval(${ids[0] ?? ""}, 'rejected', null, 'changed my mind')`)).rejects.toThrow(/already decided/);
    await expect(asClaims(owner, (tx) => tx`select public.decide_approval(${ids[1] ?? ""}, 'rejected')`)).rejects.toThrow(/why/);
    await asClaims(owner, (tx) => tx`select public.decide_approval(${ids[1] ?? ""}, 'rejected', null, 'Too pushy')`);
    const [b] = await sql`select status, feedback from approval_items where id = ${ids[1] ?? ""}`;
    expect(b).toEqual({ status: "rejected", feedback: "Too pushy" });
    const [audit] = await sql<{ n: number }[]>`select count(*)::int as n from audit_events where entity_id = ${ids[1] ?? ""}`;
    expect(audit?.n).toBeGreaterThan(0);
  });
});
