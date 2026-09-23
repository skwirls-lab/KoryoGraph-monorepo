import { chunkText, fixtureEmbedding } from "@koryo/ai";
import { sid } from "../lib/ids";
import type { SeedContext } from "./context";

// Ridgeline's knowledge base: the policies and FAQs the copilot and Home assistant answer from. Embedded
// with the deterministic fixture embedding (model "fixture") so search is reproducible offline; re-index
// in Settings → Knowledge base with a key to embed them with a real model.
const DOCS = [
  { key: "refund-policy", kind: "policy", title: "Refund policy", body: `Monthly memberships can be cancelled with 30 days' notice; the notice month is billed as usual.

Refunds: membership payments are refundable within 14 days of the charge if no classes were attended in that period. After that we offer account credit instead of a refund.

Testing fees are refundable up to 48 hours before the test. Uniforms and gear can be returned unworn within 30 days with the receipt, for a refund to the original payment method.

Paid-in-full memberships cancelled early are refunded pro rata for full unused months, less a $50 administration fee.` },
  { key: "make-up-policy", kind: "policy", title: "Make-up classes", body: `Missed a class? Students may make up any missed class within 30 days by attending another class of their program at the same rank band. Book it in the app or ask the front desk.

Holds: memberships can be put on hold for 2 to 8 weeks for travel, injury or illness. Holds are free with a week's notice. Classes during a hold don't count toward testing requirements.` },
  { key: "testing-faq", kind: "faq", title: "Belt testing FAQ", body: `How do I know my child is ready to test? The app shows each requirement for the next rank: classes attended, days since the last promotion and the skills signed off by instructors. When everything is met the student is invited to the next test.

When are tests held? Color belt tests are held on a Saturday about every eight weeks. Black belt tests are twice a year.

What does testing cost? Color belt testing is $45; black belt testing is $150 and includes the belt and certificate.

What if my child doesn't pass? They can retest at the next test at no extra charge.` },
  { key: "dress-code", kind: "policy", title: "Dress code and etiquette", body: `Students wear a clean dobok (uniform) with their current belt. Sparring gear: headgear, mouthguard, chest protector, forearm and shin guards, and a cup for boys over 8.

Remove shoes and jewellery before stepping on the mat. Bow when entering and leaving the training area. Arrive 5 minutes early.` },
] as const;

export async function seedKnowledgeBase(ctx: SeedContext, tenant = "ridgeline"): Promise<number> {
  const { sql } = ctx;
  const tid = sid(`tenant:${tenant}`);
  let n = 0;
  for (const d of DOCS) {
    const id = sid(`kb_document:${tenant}:${d.key}`);
    const chunks = chunkText(d.title, d.body);
    await sql`insert into public.kb_documents (id, tenant_id, kind, title, body, chunk_count, embedding_model, indexed_at)
      values (${id}, ${tid}, ${d.kind}, ${d.title}, ${d.body}, ${chunks.length}, 'fixture', now()) on conflict (id) do nothing`;
    for (const [i, c] of chunks.entries()) {
      const vec = `[${fixtureEmbedding(c).map((x) => Number(x.toFixed(6))).join(",")}]`;
      await sql`insert into public.kb_chunks (id, tenant_id, document_id, ordinal, content, embedding, embedding_model)
        values (${sid(`kb_chunk:${id}:${i}`)}, ${tid}, ${id}, ${i}, ${c}, ${vec}::extensions.vector, 'fixture') on conflict (id) do nothing`;
      n += 1;
    }
  }
  return n;
}
