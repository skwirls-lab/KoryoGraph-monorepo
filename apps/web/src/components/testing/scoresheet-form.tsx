"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Label } from "@koryo/ui/components/ui/label";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { saveScore } from "@/server/actions/testing";
import type { Scorable } from "@/server/queries/testing";

/** One card per student; judges score each skill 0–10 and give a result. Works on a phone. */
export function ScoresheetCard({ s }: { s: Scorable }) {
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries(s.skills.map((k) => [k.id, s.mine?.scores[k.id] ?? 7])));
  const [result, setResult] = useState<"pass" | "conditional" | "fail">((s.mine?.result as "pass" | "conditional" | "fail" | null) ?? "pass");
  const [comments, setComments] = useState(s.mine?.comments ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const avg = s.skills.length ? Object.values(scores).reduce((a, b) => a + b, 0) / s.skills.length : null;
  return (
    <section className="space-y-3 rounded-xl border border-default bg-surface p-4" aria-labelledby={`sc-${s.registrationId}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`sc-${s.registrationId}`} className="flex-1 font-semibold">{s.name}</h3>
        <span className="text-sm text-fg-secondary">→ {s.toRank}</span>
        {s.mine ? <span className="text-xs text-success">scored</span> : null}
      </div>
      {s.skills.length ? (
        <ul className="space-y-2">
          {s.skills.map((k) => (
            <li key={k.id} className="grid items-center gap-2 sm:grid-cols-[1fr_12rem_2rem]">
              <Label htmlFor={`${s.registrationId}-${k.id}`} className="font-normal">{k.name}{k.rubric ? <span className="block text-xs text-fg-muted">{k.rubric}</span> : null}</Label>
              <input id={`${s.registrationId}-${k.id}`} type="range" min={0} max={10} step={1} value={scores[k.id] ?? 0} aria-valuetext={`${scores[k.id] ?? 0} of 10`}
                onChange={(e) => setScores({ ...scores, [k.id]: Number(e.target.value) })} className="accent-[var(--color-primary)]" />
              <span className="tabular text-right text-sm">{scores[k.id]}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-fg-muted">No skills are attached to this rank — record the result only.</p>}
      {avg !== null ? <p className="text-sm">Average <strong className="tabular">{avg.toFixed(1)}</strong> / 10</p> : null}
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="sr-only">Result for {s.name}</legend>
        {(["pass", "conditional", "fail"] as const).map((r) => (
          <label key={r} className="flex items-center gap-1.5 capitalize"><input type="radio" name={`res-${s.registrationId}`} checked={result === r} onChange={() => setResult(r)} className="accent-[var(--color-primary)]" /> {r}</label>
        ))}
      </fieldset>
      <Textarea aria-label={`Comments for ${s.name}`} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments (shared with the student)" rows={2} />
      <Button size="sm" disabled={pending} onClick={() => start(async () => {
        const r = await saveScore({ registrationId: s.registrationId, scores, result, comments });
        if (r.ok) toast.success(`Saved ${s.name}`);
        else toast.error(r.error);
        router.refresh();
      })}>Save scores</Button>
    </section>
  );
}
