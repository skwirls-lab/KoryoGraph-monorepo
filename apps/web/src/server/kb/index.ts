import "server-only";
import { AiError, chunkText, type Ai } from "@koryo/ai";
import type { ServerClient } from "@koryo/db/server";

// Works with the user's client (Settings → Knowledge base) and with the jobs' client (schedule digest):
// both are SupabaseClient<Database>; RLS or the service role decides what's allowed.
type Db = ServerClient;

export const vectorLiteral = (v: number[]) => `[${v.map((x) => Number(x.toFixed(6))).join(",")}]`;

/**
 * (Re)build a document's chunks. Embeddings come from the AI gateway (live or recorded-fixture mode); if
 * embedding isn't possible (no key, budget, provider down) the chunks are still stored — text search keeps
 * working — and the document records why it isn't embedded.
 */
export async function indexDocument(db: Db, ai: Ai, doc: { id: string; tenant_id: string; title: string; body: string }, userId: string | null): Promise<{ chunks: number; embedded: boolean; error: string | null }> {
  const chunks = chunkText(doc.title, doc.body);
  let vectors: number[][] | null = null;
  let model: string | null = null;
  let error: string | null = null;
  if (chunks.length) {
    try {
      const r = await ai.embed(chunks, { tenantId: doc.tenant_id, userId });
      vectors = r.vectors;
      model = r.model;
    } catch (err) {
      error = err instanceof AiError ? err.message : "Embedding failed.";
    }
  }
  const { error: delErr } = await db.from("kb_chunks").delete().eq("document_id", doc.id);
  if (delErr) throw new Error(`kb_chunks: ${delErr.message}`);
  if (chunks.length) {
    const { error: insErr } = await db.from("kb_chunks").insert(chunks.map((content, i) => ({
      tenant_id: doc.tenant_id, document_id: doc.id, ordinal: i, content,
      embedding: vectors?.[i] ? vectorLiteral(vectors[i]) : null, embedding_model: vectors ? model : null,
    })));
    if (insErr) throw new Error(`kb_chunks: ${insErr.message}`);
  }
  await db.from("kb_documents").update({ chunk_count: chunks.length, embedding_model: vectors ? model : null, indexed_at: new Date().toISOString(), index_error: error }).eq("id", doc.id);
  return { chunks: chunks.length, embedded: Boolean(vectors), error };
}

export interface KbHit { chunkId: string; documentId: string; title: string; kind: string; content: string; score: number; vectorRank: number | null; textRank: number | null }

/** Hybrid search as the caller (RLS: members see "everyone" documents; staff see all). */
export async function searchKb(db: Db, ai: Ai, query: string, ctx: { tenantId: string; userId: string | null }, k = 5): Promise<{ hits: KbHit[]; mode: "hybrid" | "text"; note: string | null }> {
  let embedding: string | undefined;
  let model: string | undefined;
  let note: string | null = null;
  try {
    const r = await ai.embed([query], ctx);
    embedding = r.vectors[0] ? vectorLiteral(r.vectors[0]) : undefined;
    model = r.model;
  } catch (err) {
    note = err instanceof AiError ? `${err.message} Searching by text only.` : "Searching by text only.";
  }
  const { data, error } = await db.rpc("kb_search", { p_query: query, p_embedding: embedding, p_model: model, p_k: k });
  if (error) throw new Error(`kb_search: ${error.message}`);
  return {
    mode: embedding ? "hybrid" : "text", note,
    hits: (data ?? []).map((h) => ({ chunkId: h.chunk_id, documentId: h.document_id, title: h.title, kind: h.kind, content: h.content, score: h.score, vectorRank: h.vector_rank, textRank: h.text_rank })),
  };
}
