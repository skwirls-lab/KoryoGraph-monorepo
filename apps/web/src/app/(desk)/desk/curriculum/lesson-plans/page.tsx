import Link from "next/link";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import type { LessonSection } from "@/lib/curriculum";
import { requireSurfacePage } from "@/server/context";
import { listLessonPlans } from "@/server/queries/curriculum";

export const metadata = { title: "Lesson plans" };

export default async function LessonPlansPage() {
  const ctx = await requireSurfacePage("desk");
  const plans = await listLessonPlans(ctx);
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/desk/curriculum">Curriculum</Link>}
        title="Lesson plans"
        description="Reusable class templates: warm-up, technique, forms, sparring, cool-down."
        actions={ctx.permissions.has("curriculum.write") ? <Button asChild size="sm"><Link href="/desk/curriculum/lesson-plans/new">New lesson plan</Link></Button> : null}
      />
      {plans.length === 0 ? (
        <EmptyState title="No lesson plans yet" description="Build a template once and reuse it on the Mat." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const sections = (p.sections as unknown as LessonSection[]) ?? [];
            return (
              <li key={p.id}>
                <Link href={`/desk/curriculum/lesson-plans/${p.id}`} className="block rounded-xl border border-default bg-surface p-4 text-fg no-underline hover:border-strong">
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-sm text-fg-secondary">{p.programs?.name ?? "Any program"} · {sections.length} sections · {sections.reduce((m, s) => m + (s.minutes || 0), 0)} min{p.source === "ai" ? " · AI draft" : ""}</p>
                  <p className="text-xs text-fg-muted">Updated <DateText value={p.updated_at} timeZone={ctx.tz} /></p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
