import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { LessonPlanPanel } from "@/components/mat/lesson-plan-panel";
import { MatRoster } from "@/components/mat/mat-roster";
import { MessageClass } from "@/components/mat/message-class";
import { RecordClass, type RecordingRow } from "@/components/mat/record-class";
import type { LessonSection } from "@/lib/curriculum";
import { requireSurfacePage } from "@/server/context";
import { matSession } from "@/server/queries/mat";

export const metadata = { title: "Class" };

export default async function MatSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("mat");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await matSession(ctx, id);
  if (!data) notFound();
  const { session: s, rows, progress, lessonPlans } = data;
  const plan = s.lesson_plans ? { id: s.lesson_plans.id, name: s.lesson_plans.name, sections: (s.lesson_plans.sections as unknown as LessonSection[]) ?? [] } : null;
  const skillIds = [...new Set((plan?.sections ?? []).flatMap((x) => x.skill_ids))];
  const { data: skills } = skillIds.length ? await ctx.supabase.from("skills").select("id, name").in("id", skillIds) : { data: [] };
  const cancelled = s.status === "cancelled";
  const intelligence = ctx.modules.has("intelligence") && ctx.permissions.has("attendance.write");
  const [{ data: gapRows }, { data: recRows }] = intelligence ? await Promise.all([
    ctx.supabase.rpc("recording_consent_gaps", { p_session_id: s.id }),
    ctx.supabase.from("class_recordings").select("id, source, status, error, created_at, approval_item_id, approval_items(status)").eq("session_id", s.id).order("created_at", { ascending: false }).limit(5),
  ]) : [{ data: [] }, { data: [] }];
  const gaps = (gapRows ?? []).map((g) => g.name ?? "a student");
  const recordings: RecordingRow[] = (recRows ?? []).map((r) => ({ id: r.id, source: r.source, status: r.status, error: r.error, createdAt: r.created_at, approvalId: r.approval_item_id, approvalStatus: r.approval_items?.status ?? null }));
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/mat">Today</Link>}
        title={s.name}
        description={`${formatDate(s.starts_at, ctx.tz, "time")}–${formatDate(s.ends_at, ctx.tz, "time")} · ${s.locations?.name ?? ""}${s.room ? ` · ${s.room}` : ""}`}
      />
      {cancelled ? <p role="status" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm">This class is cancelled{s.cancel_reason ? ` — ${s.cancel_reason}` : ""}.</p> : null}
      <div className="space-y-6">
        {rows.length === 0 ? (
          <EmptyState title="No one on the roster yet" description="Students enrolled in this class's programs appear here. Add walk-ins as they arrive." />
        ) : null}
        {ctx.permissions.has("comms.send") && !cancelled && rows.length > 0 ? <MessageClass sessionId={s.id} /> : null}
        <MatRoster sessionId={s.id} rows={rows} progress={progress} canPromote={ctx.permissions.has("ranks.promote")} disabled={cancelled} />
        <LessonPlanPanel sessionId={s.id} current={plan} plans={lessonPlans} skills={new Map((skills ?? []).map((k) => [k.id, k.name]))} canBuild={ctx.modules.has("intelligence") && ctx.permissions.has("curriculum.write")} />
        {ctx.modules.has("intelligence") && ctx.permissions.has("attendance.write") && !cancelled ? <RecordClass sessionId={s.id} gaps={gaps} recordings={recordings} /> : null}
      </div>
    </>
  );
}
