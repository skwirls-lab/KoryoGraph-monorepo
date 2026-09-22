import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { LessonPlanEditor } from "@/components/curriculum/lesson-plan-editor";
import type { LessonSection } from "@/lib/curriculum";
import { requireSurfacePage } from "@/server/context";
import { listPrograms, listSkills } from "@/server/queries/curriculum";

export const metadata = { title: "Lesson plan" };

export default async function LessonPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: plan }, programs, skills] = await Promise.all([
    ctx.supabase.from("lesson_plans").select("id, name, program_id, sections").eq("id", id).maybeSingle(),
    listPrograms(ctx),
    listSkills(ctx, {}),
  ]);
  if (!plan) notFound();
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/curriculum/lesson-plans">Lesson plans</Link>} title={plan.name} />
      <LessonPlanEditor
        initial={{ id: plan.id, name: plan.name, programId: plan.program_id ?? "", sections: (plan.sections as unknown as LessonSection[]) ?? [] }}
        programs={programs.map((p) => ({ id: p.id, name: p.name }))}
        skills={skills.map((s) => ({ id: s.id, name: s.name, programId: s.program_id }))}
      />
    </>
  );
}
