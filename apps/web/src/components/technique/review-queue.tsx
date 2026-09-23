"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { weightedOverall, type TechniquePayload } from "@/lib/technique";
import { decideApproval } from "@/server/actions/approvals";

export interface ReviewItem {
  id: string;
  title: string;
  studentName: string;
  personId: string;
  payload: TechniquePayload;
  frames: string[];
  videoUrl: string | null;
  note: string | null;
  fixture: boolean;
}

function Review({ item }: { item: ReviewItem }) {
  const [fb, setFb] = useState(item.payload.feedback);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const scores = fb.scores;
  const overall = weightedOverall(scores, scores.map((s) => ({ criterion: s.criterion, weight: s.weight ?? 1 })));
  const setScore = (i: number, patch: Partial<(typeof scores)[number]>) => setFb({ ...fb, scores: scores.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const decide = (decision: "approved" | "rejected") => start(async () => {
    const r = await decideApproval(decision === "approved"
      ? { id: item.id, decision, payload: { ...item.payload, feedback: { ...fb, overall } } }
      : { id: item.id, decision, feedback: reason.trim() });
    if (!r.ok) { toast.error(r.error); return; }
    if (r.data.result && !r.data.result.ok) toast.error(`Couldn't release: ${r.data.result.error}`);
    else toast.success(decision === "approved" ? `Released to ${item.studentName}` : "Sent back to the family");
    router.refresh();
  });
  return (
    <article aria-label={item.title} className="space-y-4 rounded-xl border border-default bg-surface p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{item.payload.skill}</h2>
        <span className="text-sm">· <Link href={`/mat/students/${item.personId}`}>{item.studentName}</Link></span>
        {item.fixture ? <Badge variant="secondary">dev fixture</Badge> : null}
        <span className="ml-auto text-sm tabular" aria-label={`Overall ${overall} out of 5`}>{overall.toFixed(1)} / 5</span>
      </header>
      {item.note ? <p className="text-sm text-fg-secondary">Student&apos;s note: “{item.note}”</p> : null}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Keyframes">
        {item.frames.map((src, i) => (
          // Signed storage URLs (short-lived); next/image would proxy and cache them.
          // eslint-disable-next-line @next/next/no-img-element
          <li key={i}><img src={src} alt={`Frame ${i + 1} of ${item.frames.length}`} className="aspect-video w-full rounded-md border border-default object-cover" /></li>
        ))}
      </ul>
      {item.videoUrl ? <details className="text-sm"><summary className="cursor-pointer">Watch the clip</summary><video src={item.videoUrl} controls playsInline className="mt-2 max-h-80 w-full rounded-md" /></details> : null}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Rubric</legend>
        {scores.map((s, i) => (
          <div key={s.criterion} className="grid gap-2 sm:grid-cols-[10rem_5rem_1fr] sm:items-center">
            <Label htmlFor={`${item.id}-s${i}`}>{s.criterion}</Label>
            <select id={`${item.id}-s${i}`} className={`${selectClass} h-9`} value={s.score} onChange={(e) => setScore(i, { score: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Input aria-label={`${s.criterion} note`} value={s.note} onChange={(e) => setScore(i, { note: e.target.value })} />
          </div>
        ))}
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor={`${item.id}-sum`}>Summary</Label>
        <textarea id={`${item.id}-sum`} className={`${selectClass} h-20 py-2`} value={fb.summary} onChange={(e) => setFb({ ...fb, summary: e.target.value })} />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Three tips</legend>
        {fb.tips.map((t, i) => <Input key={i} aria-label={`Tip ${i + 1}`} value={t} onChange={(e) => setFb({ ...fb, tips: fb.tips.map((x, j) => (j === i ? e.target.value : x)) })} />)}
      </fieldset>
      {returning ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); decide("rejected"); }}>
          <div className="min-w-60 flex-1 space-y-1">
            <Label htmlFor={`${item.id}-why`}>Tell the family why (they&apos;ll see this)</Label>
            <Input id={`${item.id}-why`} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Too dark to see the kick — please film in better light" />
          </div>
          <Button type="submit" variant="outline" disabled={pending || reason.trim().length < 2}>Send back</Button>
          <Button type="button" variant="ghost" onClick={() => setReturning(false)}>Cancel</Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => decide("approved")}>Release to student</Button>
          <Button variant="outline" disabled={pending} onClick={() => setReturning(true)}>Send back…</Button>
        </div>
      )}
    </article>
  );
}

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  if (!items.length) return <p className="rounded-xl border border-dashed border-default p-6 text-center text-sm text-fg-secondary">No clips waiting for review.</p>;
  return <div className="space-y-4">{items.map((i) => <Review key={i.id} item={i} />)}</div>;
}
