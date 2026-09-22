import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { NoteForm } from "@/components/people/person-controls";
import { ProgressPanel } from "@/components/progress/progress-panel";
import { displayName } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { getPersonProgress } from "@/server/queries/progress";

export const metadata = { title: "Student" };

export default async function MatStudent({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("mat");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await ctx.supabase.from("people").select("id, first_name, last_name, preferred_name, allergies, injury_flags").eq("id", id).maybeSingle();
  if (!p) notFound();
  const progress = await getPersonProgress(ctx, id);
  return (
    <>
      <PageHeader eyebrow={<Link href="/mat/students">Students</Link>} title={displayName(p)} description={[...p.allergies.map((a) => `Allergy: ${a}`), ...p.injury_flags.map((i) => `Injury: ${i}`)].join(" · ") || undefined} />
      <div className="space-y-6">
        <ProgressPanel personId={p.id} progress={progress} timeZone={ctx.tz} programs={[]} canPromote={ctx.permissions.has("ranks.promote")} canEnroll={false} />
        <NoteForm personId={p.id} />
      </div>
    </>
  );
}
