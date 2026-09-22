import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ProgressPanel } from "@/components/progress/progress-panel";
import { displayName } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { householdStudents } from "@/server/queries/home";
import { getProgress } from "@/server/queries/progress";

export const metadata = { title: "Progress" };

export default async function HomeProgress() {
  const ctx = await requireSurfacePage("home");
  const students = await householdStudents(ctx);
  const progress = await getProgress(ctx, { personIds: students.map((s) => s.id) });
  return (
    <>
      <PageHeader title="Progress" description="Rank, stripes and what's next for each student." />
      {students.length === 0 ? <EmptyState title="No students yet" description="Your school hasn't added a student to your family yet." /> : (
        <div className="space-y-8">
          {students.map((s) => (
            <section key={s.id} aria-label={displayName(s)} className="space-y-3">
              <h2 className="text-xl font-bold">{displayName(s)}</h2>
              <ProgressPanel personId={s.id} progress={progress.filter((p) => p.personId === s.id)} timeZone={ctx.tz} programs={[]} canPromote={false} canEnroll={false} readOnly />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
