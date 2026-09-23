"use client";

import { Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { generateLessonPlans, saveGeneratedPlans, type DraftPlan, type Drafts } from "@/server/actions/lesson-builder";

export interface BuilderProgram { id: string; name: string; ranks: { position: number; name: string }[] }
export interface BuilderSession { id: string; label: string; programIds: string[] }

/** Prompt → draft week-by-week plans (skills from your library only) → edit → save as templates / attach to classes. */
export function LessonBuilder({ programs, sessions, fixed }: {
  programs: BuilderProgram[];
  sessions: BuilderSession[];
  /** Mat "Plan this class": one plan for this session. */
  fixed?: { sessionId: string; programId: string; minutes: number; label: string };
}) {
  const [programId, setProgramId] = useState(fixed?.programId ?? programs[0]?.id ?? "");
  const [rankFrom, setRankFrom] = useState(0);
  const [rankTo, setRankTo] = useState(0);
  const [weeks, setWeeks] = useState(fixed ? 1 : 4);
  const [minutes, setMinutes] = useState(fixed?.minutes ?? 50);
  const [prompt, setPrompt] = useState("");
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [plans, setPlans] = useState<(DraftPlan & { sessionId: string })[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const program = programs.find((p) => p.id === programId);
  const programSessions = sessions.filter((s) => s.programIds.includes(programId));
  const patch = (i: number, p: Partial<DraftPlan & { sessionId: string }>) => setPlans((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div className="space-y-5">
      <form className="space-y-3 rounded-xl border border-default bg-surface p-4" aria-label="Describe the lessons" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await generateLessonPlans({ programId, rankFrom, rankTo, weeks, minutes, prompt });
          if (!r.ok) { toast.error(r.error); return; }
          setDrafts(r.data);
          setPlans(r.data.plans.map((p) => ({ ...p, sessionId: fixed?.sessionId ?? "" })));
        });
      }}>
        {!fixed ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="lb-program">Program</Label>
              <select id="lb-program" className={selectClass} value={programId} onChange={(e) => { setProgramId(e.target.value); setRankFrom(0); setRankTo(0); }}>
                {programs.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
              </select></div>
            <div className="space-y-1"><Label htmlFor="lb-from">From rank</Label>
              <select id="lb-from" className={selectClass} value={rankFrom} onChange={(e) => setRankFrom(Number(e.target.value))}>
                <option value={0} className="bg-surface">Any</option>{program?.ranks.map((r) => <option key={r.position} value={r.position} className="bg-surface">{r.name}</option>)}
              </select></div>
            <div className="space-y-1"><Label htmlFor="lb-to">To rank</Label>
              <select id="lb-to" className={selectClass} value={rankTo} onChange={(e) => setRankTo(Number(e.target.value))}>
                <option value={0} className="bg-surface">Any</option>{program?.ranks.map((r) => <option key={r.position} value={r.position} className="bg-surface">{r.name}</option>)}
              </select></div>
            <div className="space-y-1"><Label htmlFor="lb-weeks">Weeks</Label><Input id="lb-weeks" type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="lb-min">Class length (min)</Label><Input id="lb-min" type="number" min={15} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></div>
          </div>
        ) : null}
        <div className="space-y-1"><Label htmlFor="lb-prompt">{fixed ? "What should this class focus on?" : "What do you want to teach?"}</Label>
          <textarea id="lb-prompt" className={`${selectClass} h-24 py-2`} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={fixed ? "Sparring footwork and roundhouse counters, lots of partner drills" : "A 4-week sparring block for green to blue belts: footwork, counters, ring awareness"} /></div>
        <Button type="submit" className="gap-2" disabled={pending || prompt.trim().length < 5}><Sparkles aria-hidden className="size-4" />{pending && !drafts ? "Drafting…" : "Draft lesson plans"}</Button>
      </form>

      {drafts ? (
        <section aria-labelledby="lb-drafts" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="lb-drafts" className="text-base font-semibold">Drafts ({plans.length})</h2>
            {drafts.fixture ? <Badge variant="secondary">dev fixture</Badge> : null}
            {drafts.dropped ? <span className="text-xs text-fg-muted">{drafts.dropped} skill reference(s) weren&apos;t in your library and were removed.</span> : null}
          </div>
          <ol className="space-y-3" aria-label="Draft plans">
            {plans.map((p, i) => (
              <li key={i} className="space-y-2 rounded-xl border border-default bg-surface p-4" aria-label={p.name}>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-60 flex-1 space-y-1"><Label htmlFor={`lb-name-${i}`}>Week {p.week} plan name</Label><Input id={`lb-name-${i}`} value={p.name} onChange={(e) => patch(i, { name: e.target.value })} /></div>
                  {!fixed ? (
                    <div className="space-y-1"><Label htmlFor={`lb-session-${i}`}>Use for class</Label>
                      <select id={`lb-session-${i}`} className={`${selectClass} w-64`} value={p.sessionId} onChange={(e) => patch(i, { sessionId: e.target.value })}>
                        <option value="" className="bg-surface">Save as template only</option>
                        {programSessions.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.label}</option>)}
                      </select></div>
                  ) : <span className="text-sm text-fg-muted">For {fixed.label}</span>}
                </div>
                <ol className="space-y-1.5">
                  {p.sections.map((s, j) => (
                    <li key={j} className="rounded-lg bg-elevated p-2.5 text-sm">
                      <div className="flex justify-between font-medium"><span>{s.title}</span><span className="tabular-nums text-fg-muted">{s.minutes} min</span></div>
                      {s.skill_ids.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.skill_ids.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 rounded-full border border-default px-2 py-0.5 text-xs">
                              {drafts.skillNames[id] ?? "Skill"}
                              <button type="button" aria-label={`Remove ${drafts.skillNames[id] ?? "skill"} from ${s.title}`} onClick={() => patch(i, { sections: p.sections.map((x, k) => (k === j ? { ...x, skill_ids: x.skill_ids.filter((y) => y !== id) } : x)) })}><X className="size-3" /></button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {s.notes ? <p className="mt-1 whitespace-pre-wrap text-xs text-fg-secondary">{s.notes}</p> : null}
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-fg-muted">{p.sections.reduce((a, s) => a + s.minutes, 0)} minutes</p>
              </li>
            ))}
          </ol>
          {drafts.suggested.length ? (
            <section aria-labelledby="lb-sugg" className="rounded-xl border border-warning/50 bg-warning/5 p-3 text-sm">
              <h3 id="lb-sugg" className="font-medium">Skills your library doesn&apos;t have (not added — add them in Curriculum if you want them)</h3>
              <ul className="list-disc pl-5">{drafts.suggested.map((s) => <li key={s.name}><strong>{s.name}</strong> ({s.category}) — {s.reason}</li>)}</ul>
            </section>
          ) : null}
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await saveGeneratedPlans({ programId, runId: drafts.runId, plans: plans.map((p) => ({ ...p, sessionId: p.sessionId || null })) });
            if (!r.ok) { toast.error(r.error); return; }
            toast.success(`Saved ${r.data.ids.length} plan${r.data.ids.length === 1 ? "" : "s"}${r.data.assigned ? `, attached to ${r.data.assigned} class${r.data.assigned === 1 ? "" : "es"}` : ""}`);
            setDrafts(null);
            router.push(fixed ? `/mat/session/${fixed.sessionId}` : "/desk/curriculum/lesson-plans");
          })}>{fixed ? "Save and use for this class" : "Save plans"}</Button>
        </section>
      ) : null}
    </div>
  );
}
