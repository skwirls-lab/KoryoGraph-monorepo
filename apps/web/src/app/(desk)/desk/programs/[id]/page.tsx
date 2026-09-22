import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { LadderEditor, type LadderRank } from "@/components/curriculum/ladder-editor";
import { EditProgramDialog } from "@/components/curriculum/program-form";
import { requireSurfacePage } from "@/server/context";
import { getProgram } from "@/server/queries/curriculum";

export const metadata = { title: "Program" };

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getProgram(ctx, id);
  if (!data) notFound();
  const { program: p, ranks, skills } = data;
  const canWrite = ctx.permissions.has("curriculum.write");
  const ladder: LadderRank[] = ranks.map((r) => {
    const req = Array.isArray(r.rank_requirements) ? r.rank_requirements[0] : r.rank_requirements;
    return {
      id: r.id, name: r.name, beltColor: r.belt_color, position: r.position, stripesMax: r.stripes_max, testingFeeCents: r.testing_fee_cents,
      requirement: req ? { minClasses: req.min_classes, minDays: req.min_days, approval: req.requires_instructor_approval, notes: req.notes } : null,
      skillIds: r.rank_skills.filter((s) => s.required).map((s) => s.skill_id),
    };
  });
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/desk/programs">Programs</Link>}
        title={p.name}
        description={p.description || undefined}
        actions={canWrite ? (
          <EditProgramDialog initial={{ id: p.id, name: p.name, description: p.description, ageMin: p.age_min ?? "", ageMax: p.age_max ?? "", color: p.color, inviteOnly: p.invite_only, active: p.active }} />
        ) : null}
      />
      <LadderEditor
        programId={p.id}
        ranks={ladder}
        skills={skills.map((s) => ({ id: s.id, name: s.name, category: s.category, shared: s.program_id === null }))}
        canWrite={canWrite}
      />
    </>
  );
}
