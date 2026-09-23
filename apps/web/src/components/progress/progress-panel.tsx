import Link from "next/link";
import { describeGap } from "@koryo/eligibility";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { RankBadge } from "@koryo/ui/components/app/rank-badge";
import { Badge } from "@koryo/ui/components/ui/badge";
import { cn } from "@koryo/ui/lib/utils";
import type { EnrollmentProgress } from "@/server/queries/progress";
import { ApproveButton, AwardStripeButton, EnrollDialog, PromoteDialog, SignOffButton } from "./progress-actions";

const ELIGIBILITY_TONE = { eligible: "border-success/50 text-success", almost: "border-warning/50 text-warning", not_yet: "border-default text-fg-secondary" } as const;
const ELIGIBILITY_LABEL = { eligible: "Eligible to test", almost: "Almost eligible", not_yet: "Not yet eligible" } as const;

function Bar({ label, have, need }: { label: string; have: number; need: number }) {
  const pct = need > 0 ? Math.min(100, Math.round((have / need) * 100)) : 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-fg-secondary">{label}</span><span className="tabular">{have}/{need}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(have, need)}>
        <div className={cn("h-full", pct >= 100 ? "bg-success" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export interface ProgressPanelProps {
  personId: string;
  progress: EnrollmentProgress[];
  timeZone: string;
  canPromote: boolean;
  canEnroll: boolean;
  programs: { id: string; name: string; ranks: { id: string; name: string }[] }[];
  /** Home shows a simpler, read-only view. */
  readOnly?: boolean;
  /** Home with the vision module: link each skill to "get feedback on a practice clip" under this path. */
  feedbackBase?: string;
}

export function ProgressPanel({ personId, progress, timeZone, canPromote, canEnroll, programs, readOnly, feedbackBase }: ProgressPanelProps) {
  const enrolledIds = new Set(progress.map((p) => p.programId));
  const available = programs.filter((p) => !enrolledIds.has(p.id) && p.ranks.length > 0);
  return (
    <div className="space-y-4">
      {!readOnly && canEnroll && available.length > 0 ? <div className="flex justify-end"><EnrollDialog personId={personId} programs={available} /></div> : null}
      {progress.length === 0 ? (
        <EmptyState title="Not enrolled in a program" description={readOnly ? "Your school hasn't enrolled this student yet." : "Enroll this student to track rank, requirements and promotions."} />
      ) : null}
      {progress.map((e) => (
        <section key={e.enrollmentId} className="space-y-4 rounded-xl border border-default bg-surface p-4 sm:p-5" aria-label={`${e.programName} progress`}>
          <header className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold">{e.programName}</h3>
            {e.current ? <RankBadge name={e.current.name} beltColor={e.current.color} stripes={e.stripes} stripesMax={e.stripesMax} /> : null}
            {e.status !== "active" ? <Badge variant="outline" className="capitalize">{e.status}</Badge> : null}
            <Badge variant="outline" className={cn("ml-auto bg-transparent", ELIGIBILITY_TONE[e.eligibility.status])}>{ELIGIBILITY_LABEL[e.eligibility.status]}</Badge>
          </header>
          {e.next ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm text-fg-secondary">Next: <strong className="text-fg">{e.next.name}</strong></p>
                <Bar label="Classes since last promotion" have={e.classes.have} need={e.classes.need} />
                <Bar label="Days since last promotion" have={e.days.have} need={e.days.need} />
                {e.eligibility.gaps.length > 0 && e.eligibility.status !== "not_yet" ? (
                  <ul className="text-sm text-warning">{e.eligibility.gaps.map((g, i) => <li key={i}>{describeGap(g, (id) => e.skills.find((s) => s.id === id)?.name ?? "skill")}</li>)}</ul>
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Required for {e.next.name}</p>
                {e.skills.length === 0 && !e.requiresApproval ? <p className="text-sm text-fg-muted">No skills required.</p> : null}
                <ul className="space-y-1">
                  {e.skills.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className={s.signed ? "text-success" : undefined}>{s.signed ? "✓ " : "○ "}{s.name}</span>
                      {feedbackBase ? <Link href={`${feedbackBase}/${s.id}/submit?student=${personId}`} className="text-xs" aria-label={`Get feedback on ${s.name}`}>Get feedback</Link> : null}
                      {!readOnly && canPromote && !s.signed ? <SignOffButton enrollmentId={e.enrollmentId} skillId={s.id} skillName={s.name} personId={personId} /> : null}
                    </li>
                  ))}
                  {e.requiresApproval ? (
                    <li className="flex items-center justify-between gap-2 text-sm">
                      <span className={e.approved ? "text-success" : undefined}>{e.approved ? "✓ " : "○ "}Instructor approval</span>
                      {!readOnly && canPromote && !e.approved ? <ApproveButton enrollmentId={e.enrollmentId} rankId={e.next.id} personId={personId} /> : null}
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg-secondary">Highest rank in this program.</p>
          )}
          {!readOnly && canPromote ? (
            <div className="flex flex-wrap gap-2">
              <AwardStripeButton enrollmentId={e.enrollmentId} personId={personId} disabled={e.stripesMax === 0 || e.stripes >= e.stripesMax} />
              <PromoteDialog enrollmentId={e.enrollmentId} personId={personId} ladder={e.ladder} currentRankId={e.current?.id ?? null} nextRankId={e.next?.id ?? null} />
            </div>
          ) : null}
          <details className="text-sm" open={readOnly}>
            <summary className="cursor-pointer font-medium">Rank history</summary>
            {e.history.length === 0 ? <p className="pt-2 text-fg-muted">Enrolled <DateText value={e.startedAt} timeZone={timeZone} />. No promotions yet.</p> : (
              <ol className="space-y-1 pt-2" aria-label={`${e.programName} history`}>
                {e.history.map((h, i) => (
                  <li key={i} className="flex gap-2"><DateText value={h.at} timeZone={timeZone} className="shrink-0 text-fg-muted" /><span>{h.text}</span></li>
                ))}
              </ol>
            )}
          </details>
        </section>
      ))}
    </div>
  );
}
