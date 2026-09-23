import { randomUUID } from "node:crypto";
import { fixtureEmbedding } from "@koryo/ai";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sid } from "../../scripts/lib/ids";
import { asClaims, seededClaims, sql } from "./harness";

const R = sid("tenant:ridgeline");
const staffDoc = randomUUID();
const vec = (t: string) => `[${fixtureEmbedding(t).join(",")}]`;

beforeAll(async () => {
  await sql`insert into kb_documents (id, tenant_id, kind, title, body, audience) values (${staffDoc}, ${R}, 'other', 'Staff refund escalation', 'Internal refund escalation steps for staff only.', 'staff')`;
  await sql`insert into kb_chunks (tenant_id, document_id, ordinal, content, embedding, embedding_model) values (${R}, ${staffDoc}, 0, 'Staff refund escalation: internal refund steps', ${vec("Staff refund escalation: internal refund steps")}::extensions.vector, 'fixture')`;
});

afterAll(async () => {
  await sql`delete from kb_documents where id = ${staffDoc}`;
  await sql.end();
});

describe("knowledge base search", () => {
  it("'refund policy' returns the seeded refund policy chunk first (hybrid: fixture vectors + text)", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const hits = await asClaims(owner, (tx) => tx<{ title: string; vector_rank: number | null; text_rank: number | null }[]>`
      select title, vector_rank, text_rank from public.kb_search('refund policy', ${vec("refund policy")}::extensions.vector, 'fixture', 5)`);
    expect(hits[0]?.title).toBe("Refund policy");
    expect(hits[0]?.vector_rank).not.toBeNull();
    expect(hits[0]?.text_rank).not.toBeNull();
  });

  it("text-only when there's no embedding, and a different model's vectors are ignored", async () => {
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const text = await asClaims(owner, (tx) => tx<{ title: string; vector_rank: number | null }[]>`select title, vector_rank from public.kb_search('make up a missed class', null, null, 3)`);
    expect(text[0]?.title).toBe("Make-up classes");
    expect(text.every((h) => h.vector_rank === null)).toBe(true);
    const other = await asClaims(owner, (tx) => tx<{ vector_rank: number | null }[]>`select vector_rank from public.kb_search('refund policy', ${vec("refund policy")}::extensions.vector, 'some-other-model', 3)`);
    expect(other.every((h) => h.vector_rank === null)).toBe(true);
  });

  it("families see 'everyone' documents only; other tenants see nothing", async () => {
    const parent = await seededClaims("parent@ridgelinetkd.demo");
    const hits = await asClaims(parent, (tx) => tx<{ title: string }[]>`select title from public.kb_search('refund', ${vec("refund")}::extensions.vector, 'fixture', 10)`);
    expect(hits.map((h) => h.title)).toContain("Refund policy");
    expect(hits.map((h) => h.title)).not.toContain("Staff refund escalation");
    const owner = await seededClaims("owner@ridgelinetkd.demo");
    const staff = await asClaims(owner, (tx) => tx<{ title: string }[]>`select title from public.kb_search('refund escalation', null, null, 10)`);
    expect(staff.map((h) => h.title)).toContain("Staff refund escalation");
    const harbor = await seededClaims("owner@harborbjj.demo");
    expect(await asClaims(harbor, (tx) => tx`select title from public.kb_search('refund policy', null, null, 10)`)).toHaveLength(0);
    await expect(asClaims(parent, (tx) => tx`insert into kb_documents (tenant_id, title) values (${R}, 'Sneaky')`)).rejects.toThrow();
  });
});
