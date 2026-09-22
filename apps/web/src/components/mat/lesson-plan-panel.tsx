"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { LessonSection } from "@/lib/curriculum";
import { assignLessonPlan } from "@/server/actions/mat";

export function LessonPlanPanel({ sessionId, current, plans, skills }: {
  sessionId: string; current: { id: string; name: string; sections: LessonSection[] } | null; plans: { id: string; name: string }[]; skills: Map<string, string>;
}) {
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 rounded-xl border border-default bg-surface p-4" aria-labelledby="plan-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-h" className="font-semibold">Lesson plan</h2>
        <label className="text-sm">
          <span className="sr-only">Choose a lesson plan</span>
          <select className="h-10 rounded-md border border-input bg-transparent px-2 text-sm text-fg" value={current?.id ?? ""} disabled={pending}
            onChange={(e) => start(async () => { const r = await assignLessonPlan({ sessionId, lessonPlanId: e.target.value || null }); if (!r.ok) toast.error(r.error); })}>
            <option value="" className="bg-surface">No plan</option>
            {plans.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
          </select>
        </label>
      </div>
      {current ? (
        <ol className="space-y-2">
          {current.sections.map((s, i) => (
            <li key={i} className="rounded-lg bg-elevated p-3">
              <div className="flex justify-between text-sm font-medium"><span>{s.title}</span><span className="tabular text-fg-muted">{s.minutes} min</span></div>
              {s.skill_ids.length ? <p className="text-xs text-fg-secondary">{s.skill_ids.map((id) => skills.get(id) ?? "Skill").join(" · ")}</p> : null}
              {s.notes ? <p className="whitespace-pre-wrap text-xs text-fg-muted">{s.notes}</p> : null}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-fg-muted">No plan attached. Pick one of your templates.</p>}
    </section>
  );
}
