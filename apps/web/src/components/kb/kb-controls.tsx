"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { KB_KINDS, type KbDocInput } from "@/lib/validation/kb";
import { deleteKbDocument, reindexKbDocument, saveKbDocument, testKbSearch } from "@/server/actions/knowledge";
import type { KbHit } from "@/server/kb";

export function KbDocForm({ initial, onDone }: { initial?: KbDocInput; onDone?: () => void }) {
  const empty: KbDocInput = { title: "", kind: "policy", audience: "everyone", body: "" };
  const [v, setV] = useState<KbDocInput>(initial ?? empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = initial?.id ?? "new";
  return (
    <form className="space-y-3" aria-label={initial ? `Edit ${initial.title}` : "Add a document"} onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveKbDocument(v);
        if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
        setErrors({});
        toast.success(`Saved — ${r.data.chunks} chunk${r.data.chunks === 1 ? "" : "s"}${r.data.embedded ? " embedded" : ` (text search only: ${r.data.note ?? "not embedded"})`}`);
        if (!initial) setV(empty);
        onDone?.();
        router.refresh();
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
        <div className="space-y-1"><Label htmlFor={`kb-title-${id}`}>Title</Label><Input id={`kb-title-${id}`} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />{errors.title ? <p className="text-xs text-danger">{errors.title}</p> : null}</div>
        <div className="space-y-1"><Label htmlFor={`kb-kind-${id}`}>Kind</Label>
          <select id={`kb-kind-${id}`} className={selectClass} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as KbDocInput["kind"] })}>
            {(["policy", "faq", "curriculum", "other"] as const).map((k) => <option key={k} value={k} className="bg-surface">{KB_KINDS[k]}</option>)}
          </select></div>
        <div className="space-y-1"><Label htmlFor={`kb-aud-${id}`}>Who can see it</Label>
          <select id={`kb-aud-${id}`} className={selectClass} value={v.audience} onChange={(e) => setV({ ...v, audience: e.target.value as KbDocInput["audience"] })}>
            <option value="everyone" className="bg-surface">Families and staff</option><option value="staff" className="bg-surface">Staff only</option>
          </select></div>
      </div>
      <div className="space-y-1"><Label htmlFor={`kb-body-${id}`}>Text</Label>
        <textarea id={`kb-body-${id}`} className={`${selectClass} h-48 py-2`} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} />
        {errors.body ? <p className="text-xs text-danger">{errors.body}</p> : null}</div>
      <Button type="submit" disabled={pending}>{pending ? "Saving and indexing…" : initial ? "Save and re-index" : "Add and index"}</Button>
    </form>
  );
}

export function KbRowActions({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="flex gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
        const r = await reindexKbDocument({ id });
        if (r.ok) toast.success(`Re-indexed ${title}: ${r.data.chunks} chunks${r.data.embedded ? "" : " (text only)"}`); else toast.error(r.error);
        router.refresh();
      })}>Re-index</Button>
      <Button size="sm" variant="ghost" disabled={pending} aria-label={`Delete ${title}`} onClick={() => { if (!confirm(`Delete "${title}" from the knowledge base?`)) return; start(async () => { const r = await deleteKbDocument({ id }); if (!r.ok) toast.error(r.error); router.refresh(); }); }}>Delete</Button>
    </span>
  );
}

export function KbSearchTester() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ hits: KbHit[]; mode: string; note: string | null } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await testKbSearch({ query: q }); if (r.ok) setRes(r.data); else toast.error(r.error); }); }}>
        <Label htmlFor="kb-q" className="sr-only">Test question</Label>
        <Input id="kb-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Can I get a refund for a testing fee?" />
        <Button type="submit" disabled={pending || q.trim().length < 2}>Search</Button>
      </form>
      {res ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-xs text-fg-muted">{res.mode === "hybrid" ? "Hybrid search (meaning + words)" : "Text search"}{res.note ? ` — ${res.note}` : ""}</p>
          {!res.hits.length ? <p className="text-sm text-fg-muted">Nothing found.</p> : (
            <ol className="space-y-2" aria-label="Search results">
              {res.hits.map((h) => (
                <li key={h.chunkId} className="rounded-lg border border-default p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-medium">{h.title}</span><Badge variant="outline">{h.score.toFixed(4)}</Badge>
                    <span className="text-xs text-fg-muted">{h.vectorRank ? `meaning #${h.vectorRank}` : ""}{h.vectorRank && h.textRank ? " · " : ""}{h.textRank ? `words #${h.textRank}` : ""}</span></div>
                  <p className="line-clamp-3 whitespace-pre-line text-fg-secondary">{h.content}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}
