"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import type { BoardPayload } from "@/server/action-board";
import { decideApproval } from "@/server/actions/approvals";

const LOW = 0.7;

function Row({ label, checked, onChange, confidence, children }: { label: string; checked: boolean; onChange: (v: boolean) => void; confidence?: number; children: React.ReactNode }) {
  const low = confidence !== undefined && confidence < LOW;
  return (
    <li className={`flex items-start gap-3 py-2 ${low ? "rounded-md bg-warning/10 px-2" : ""}`}>
      <input type="checkbox" className="mt-1 size-5 accent-[var(--color-primary)]" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {confidence !== undefined ? <Badge variant={low ? "outline" : "secondary"}>{low ? "check" : ""}{low ? " · " : ""}{Math.round(confidence * 100)}%</Badge> : null}
    </li>
  );
}

/** The drafted board: tick what's right (uncertain rows start unticked), then approve to write it. */
export function ActionBoard({ approvalId, initial, fixture }: { approvalId: string; initial: BoardPayload; fixture: boolean }) {
  const [b, setB] = useState(initial);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends "attendance" | "skill_notes" | "injuries" | "follow_ups">(k: K, i: number, include: boolean) =>
    setB((x) => ({ ...x, [k]: (x[k] as { include: boolean }[]).map((r, j) => (j === i ? { ...r, include } : r)) }));
  const counts = { a: b.attendance.filter((x) => x.include).length, s: b.skill_notes.filter((x) => x.include).length, i: b.injuries.filter((x) => x.include).length, f: b.follow_ups.filter((x) => x.include).length };
  if (done) return <p role="status" className="rounded-xl border border-success/40 bg-success/10 p-4">Saved: {done}.</p>;
  return (
    <div className="space-y-4">
      {fixture ? <Badge variant="secondary">dev fixture</Badge> : null}
      {b.ignored ? <p className="text-xs text-fg-muted">{b.ignored} item(s) mentioned people or skills that aren&apos;t on this class, so they were left out.</p> : null}
      <section aria-labelledby="ab-att" className="rounded-xl border border-default bg-surface p-4">
        <h2 id="ab-att" className="font-semibold">Attendance ({counts.a}/{b.attendance.length})</h2>
        <ul className="divide-y divide-default" aria-label="Attendance confirmations">
          {b.attendance.map((a, i) => <Row key={a.person_id} label={`${a.name} was here`} checked={a.include} confidence={a.confidence} onChange={(v) => set("attendance", i, v)}><span className="font-medium">{a.name}</span> <span className="text-fg-muted">— “{a.evidence}”</span></Row>)}
        </ul>
      </section>
      <section aria-labelledby="ab-skills" className="rounded-xl border border-default bg-surface p-4">
        <h2 id="ab-skills" className="font-semibold">Skill notes ({counts.s}/{b.skill_notes.length})</h2>
        <ul className="divide-y divide-default" aria-label="Skill notes">
          {b.skill_notes.map((s, i) => <Row key={i} label={`${s.sign_off ? "Sign off" : "Note"} ${s.skill_name ?? ""} for ${s.name}`} checked={s.include} confidence={s.confidence} onChange={(v) => set("skill_notes", i, v)}>
            <span className="font-medium">{s.name}</span>{s.skill_name ? <> · {s.skill_name}</> : null} {s.sign_off ? <Badge variant="secondary">sign-off</Badge> : <Badge variant="outline">note</Badge>}
            <div className="text-fg-secondary">{s.note}</div></Row>)}
        </ul>
      </section>
      {b.injuries.length ? (
        <section aria-labelledby="ab-inj" className="rounded-xl border border-danger/40 bg-surface p-4">
          <h2 id="ab-inj" className="font-semibold">Injuries ({counts.i}/{b.injuries.length})</h2>
          <ul className="divide-y divide-default" aria-label="Injuries">
            {b.injuries.map((x, i) => <Row key={i} label={`Injury note for ${x.name}`} checked={x.include} confidence={x.confidence} onChange={(v) => set("injuries", i, v)}><span className="font-medium">{x.name}</span> — {x.note}</Row>)}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="ab-fu" className="rounded-xl border border-default bg-surface p-4">
        <h2 id="ab-fu" className="font-semibold">Follow-ups ({counts.f}/{b.follow_ups.length})</h2>
        <ul className="divide-y divide-default" aria-label="Follow-ups">
          {b.follow_ups.map((f, i) => <Row key={i} label={`Task: ${f.title}`} checked={f.include} onChange={(v) => set("follow_ups", i, v)}>{f.title}{f.name ? <span className="text-fg-muted"> · {f.name}</span> : null}</Row>)}
        </ul>
      </section>
      {rejecting ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await decideApproval({ id: approvalId, decision: "rejected", feedback: reason }); if (r.ok) { toast.success("Discarded"); router.push(`/mat/session/${b.session_id}`); } else toast.error(r.error); }); }}>
          <div className="min-w-60 flex-1 space-y-1"><Label htmlFor="ab-why">Why discard it?</Label><Input id="ab-why" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button type="submit" variant="outline" disabled={pending || reason.trim().length < 2}>Discard board</Button>
        </form>
      ) : null}
      <div className="sticky bottom-20 flex flex-wrap gap-2 rounded-xl border border-default bg-surface p-3 shadow-kg-sm">
        <Button className="h-12 flex-1" disabled={pending} onClick={() => start(async () => {
          const r = await decideApproval({ id: approvalId, decision: "approved", payload: b });
          if (!r.ok) { toast.error(r.error); return; }
          if (r.data.result && !r.data.result.ok) { toast.error(r.data.result.error); return; }
          setDone(r.data.result?.ok ? r.data.result.summary : "done");
        })}>Approve all ({counts.a + counts.s + counts.i + counts.f})</Button>
        <Button variant="ghost" className="h-12" onClick={() => setRejecting(true)}>Discard…</Button>
      </div>
    </div>
  );
}
