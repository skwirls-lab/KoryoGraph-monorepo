import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { LessonPlanEditor } from "@/components/curriculum/lesson-plan-editor";
import { requireSurfacePage } from "@/server/context";
import { listPrograms, listSkills } from "@/server/queries/curriculum";

export const metadata = { title: "New lesson plan" };

export default async function NewLessonPlanPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("curriculum.write")) forbidden();
  const [programs, skills] = await Promise.all([listPrograms(ctx), listSkills(ctx, {})]);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/curriculum/lesson-plans">Lesson plans</Link>} title="New lesson plan" />
      <LessonPlanEditor programs={programs.map((p) => ({ id: p.id, name: p.name }))} skills={skills.map((s) => ({ id: s.id, name: s.name, programId: s.program_id }))} />
    </>
  );
}
