"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { APPROVAL_KINDS, MESSAGE_KINDS, type ApprovalKind, type MessagePayload } from "@/lib/approvals";
import { bulkApprove, decideApproval } from "@/server/actions/approvals";

export interface QueueItem {
  id: string;
  kind: ApprovalKind;
  title: string;
  preview: string;
  payload: unknown;
  createdAt: string;
  personId: string | null;
  personName: string | null;
  fixture: boolean;
}

function MessageEditor({ id, value, onChange }: { id: string; value: MessagePayload; onChange: (v: MessagePayload) => void }) {
  return (
    <div className="space-y-3">
      {value.messages.map((m, i) => (
        <div key={i} className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-fg-muted">{m.channel === "sms" ? "Text message" : "Email"}</div>
          {m.channel === "email" ? (
            <><Label htmlFor={`${id}-s${i}`} className="sr-only">Subject</Label>
              <Input id={`${id}-s${i}`} value={m.subject ?? ""} onChange={(e) => onChange({ ...value, messages: value.messages.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)) })} aria-label="Subject" /></>
          ) : null}
          <textarea aria-label={m.channel === "sms" ? "Text message" : "Email body"} className={`${selectClass} h-28 py-2`} value={m.body}
            onChange={(e) => onChange({ ...value, messages: value.messages.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
          {m.channel === "sms" ? <div className="text-right text-xs text-fg-muted">{m.body.length} characters</div> : null}
        </div>
      ))}
    </div>
  );
}

/** Keyboard: j/k move, a approve, r reject (asks why), x select. Edits are saved with the approval. */
export function ApprovalQueue({ items, canApprove }: { items: QueueItem[]; canApprove: boolean }) {
  const [focus, setFocus] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const refs = useRef<(HTMLElement | null)[]>([]);
  const router = useRouter();

  const approve = useCallback((it: QueueItem) => start(async () => {
    const r = await decideApproval({ id: it.id, decision: "approved", payload: drafts[it.id] });
    if (!r.ok) { toast.error(r.error); return; }
    if (r.data.result && !r.data.result.ok) toast.error(`Approved, but it couldn't be carried out: ${r.data.result.error}`);
    else toast.success(r.data.result?.ok ? `Approved — ${r.data.result.summary}` : "Approved");
    router.refresh();
  }), [drafts, router]);
  const reject = (it: QueueItem) => start(async () => {
    const r = await decideApproval({ id: it.id, decision: "rejected", feedback: reason });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success("Rejected — the reason is kept as feedback");
    setRejecting(null);
    setReason("");
    router.refresh();
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const it = items[focus];
      if (e.key === "j" || e.key === "k") {
        const next = Math.max(0, Math.min(items.length - 1, focus + (e.key === "j" ? 1 : -1)));
        setFocus(next);
        refs.current[next]?.focus();
      } else if (e.key === "a" && it && canApprove) approve(it);
      else if (e.key === "r" && it && canApprove) { e.preventDefault(); setRejecting(it.id); }
      else if (e.key === "x" && it) setSelected((s) => (s.includes(it.id) ? s.filter((x) => x !== it.id) : [...s, it.id]));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, focus, canApprove, approve]);

  if (!items.length) return <p className="rounded-xl border border-dashed border-default p-6 text-center text-sm text-fg-secondary">Nothing waiting for approval.</p>;
  return (
    <div className="space-y-3">
      {canApprove ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--color-primary)]" checked={selected.length === items.length}
            onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])} /> Select all</label>
          <Button size="sm" disabled={pending || !selected.length} onClick={() => start(async () => {
            const r = await bulkApprove({ ids: selected });
            if (!r.ok) { toast.error(r.error); return; }
            toast.success(`Approved ${r.data.approved}${r.data.failed ? ` · ${r.data.failed} couldn't be carried out` : ""}`);
            setSelected([]);
            router.refresh();
          })}>Approve selected ({selected.length})</Button>
          <span className="ml-auto text-xs text-fg-muted">Keys: j/k move · a approve · r reject · x select</span>
        </div>
      ) : <p className="text-sm text-fg-muted">You can see the queue; approving needs the ai.approve permission.</p>}
      <ol className="space-y-3" aria-label="Pending approvals">
        {items.map((it, i) => {
          const isMessage = MESSAGE_KINDS.includes(it.kind);
          const draft = (drafts[it.id] ?? it.payload) as MessagePayload;
          return (
            <li key={it.id}>
              <article ref={(el) => { refs.current[i] = el; }} tabIndex={-1} aria-label={it.title} onFocus={() => setFocus(i)}
                className={`space-y-3 rounded-xl border bg-surface p-4 outline-none ${i === focus ? "border-primary" : "border-default"}`}>
                <header className="flex flex-wrap items-center gap-2">
                  {canApprove ? <input type="checkbox" aria-label={`Select ${it.title}`} className="accent-[var(--color-primary)]" checked={selected.includes(it.id)}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, it.id] : s.filter((x) => x !== it.id)))} /> : null}
                  <Badge variant="outline">{APPROVAL_KINDS[it.kind]}</Badge>
                  <h2 className="font-semibold">{it.title}</h2>
                  {it.fixture ? <Badge variant="secondary">dev fixture</Badge> : null}
                  <span className="ml-auto text-xs text-fg-muted">{new Date(it.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                </header>
                {it.personId ? <p className="text-sm">About <Link href={`/desk/people/${it.personId}`}>{it.personName ?? "this student"}</Link></p> : null}
                {it.preview ? <p className="whitespace-pre-line text-sm text-fg-secondary">{it.preview}</p> : null}
                {isMessage ? <MessageEditor id={it.id} value={draft} onChange={(v) => setDrafts((d) => ({ ...d, [it.id]: v }))} />
                  : <pre className="max-h-60 overflow-auto rounded-lg bg-elevated p-3 text-xs" tabIndex={0} aria-label="Details">{JSON.stringify(it.payload, null, 2)}</pre>}
                {canApprove ? (
                  rejecting === it.id ? (
                    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); reject(it); }}>
                      <div className="min-w-60 flex-1 space-y-1"><Label htmlFor={`why-${it.id}`}>Why reject?</Label>
                        <Input id={`why-${it.id}`} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Too formal; she's on a family trip" /></div>
                      <Button type="submit" variant="outline" disabled={pending || reason.trim().length < 2}>Reject</Button>
                      <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <div className="flex gap-2">
                      <Button disabled={pending} onClick={() => approve(it)}>{isMessage ? "Approve and send" : "Approve"}</Button>
                      <Button variant="outline" disabled={pending} onClick={() => setRejecting(it.id)}>Reject…</Button>
                    </div>
                  )
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
