import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { ArchiveSkillButton } from "@/components/curriculum/archive-skill-button";
import { SkillDialog } from "@/components/curriculum/skill-dialog";
import { CATEGORY_LABELS, SKILL_CATEGORIES, type RubricRow, type SkillCategory } from "@/lib/curriculum";
import { requireSurfacePage } from "@/server/context";
import { listPrograms, listSkills } from "@/server/queries/curriculum";

export const metadata = { title: "Curriculum" };

export default async function CurriculumPage({ searchParams }: { searchParams: Promise<{ program?: string; category?: string; q?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  const sp = await searchParams;
  const [programs, skills] = await Promise.all([listPrograms(ctx), listSkills(ctx, { programId: sp.program, category: sp.category, q: sp.q })]);
  const canWrite = ctx.permissions.has("curriculum.write");
  const programOptions = programs.map((p) => ({ id: p.id, name: p.name }));
  const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg";
  return (
    <>
      <PageHeader
        title="Curriculum"
        description="Techniques, forms and drills with rubrics and videos. Ranks require them; lesson plans use them."
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/desk/curriculum/lesson-plans">Lesson plans</Link></Button>
            {ctx.modules.has("intelligence") && ctx.permissions.has("curriculum.write") ? <Button asChild variant="outline" size="sm"><Link href="/desk/curriculum/build">Lesson builder</Link></Button> : null}
            {canWrite ? <SkillDialog programs={programOptions} trigger={<Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New skill</Button>} /> : null}
          </>
        }
      />
      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">Search<input name="q" defaultValue={sp.q ?? ""} className={`${selectClass} w-56`} /></label>
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">Program
          <select name="program" defaultValue={sp.program ?? ""} className={selectClass}>
            <option value="" className="bg-surface">All</option>
            <option value="shared" className="bg-surface">Shared</option>
            {programOptions.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">Category
          <select name="category" defaultValue={sp.category ?? ""} className={selectClass}>
            <option value="" className="bg-surface">All</option>
            {SKILL_CATEGORIES.map((c) => <option key={c} value={c} className="bg-surface">{CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <Button type="submit" variant="secondary" size="sm">Filter</Button>
      </form>
      {skills.length === 0 ? (
        <EmptyState title="No skills match" description="Add techniques, forms and drills to build your curriculum." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {skills.map((s) => (
            <li key={s.id} className="space-y-2 rounded-xl border border-default bg-surface p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{s.name}</h2>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Badge variant="secondary">{CATEGORY_LABELS[s.category as SkillCategory] ?? s.category}</Badge>
                    <Badge variant="outline">{s.programs?.name ?? "Shared"}</Badge>
                  </div>
                </div>
                {canWrite ? (
                  <>
                    <SkillDialog
                      programs={programOptions}
                      initial={{ id: s.id, programId: s.program_id ?? "", category: s.category as SkillCategory, name: s.name, description: s.description, videoUrl: s.video_url ?? "", rubric: (s.rubric as unknown as RubricRow[]) ?? [] }}
                      trigger={<Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`}><Pencil className="size-4" /></Button>}
                    />
                    <ArchiveSkillButton id={s.id} name={s.name} />
                  </>
                ) : null}
              </div>
              {s.description ? <p className="text-sm text-fg-secondary">{s.description}</p> : null}
              {s.video_url ? <a href={s.video_url} target="_blank" rel="noreferrer" className="text-sm">Watch video</a> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
