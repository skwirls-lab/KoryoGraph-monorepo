import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { LessonBuilder } from "@/components/curriculum/lesson-builder";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Lesson builder" };

export default async function LessonBuilderPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("curriculum.write")) forbidden();
  if (!ctx.modules.has("intelligence")) return <><PageHeader title="Lesson builder" /><p className="text-sm text-fg-secondary">The lesson builder is part of the Intelligence module. Build plans by hand in <Link href="/desk/curriculum/lesson-plans">Lesson plans</Link>.</p></>;
  const now = new Date();
  const [{ data: programs }, { data: sessions }] = await Promise.all([
    ctx.supabase.from("programs").select("id, name, ranks(position, name)").eq("active", true).order("sort").order("name"),
    ctx.supabase.from("class_sessions").select("id, name, starts_at, program_ids").eq("status", "scheduled").gte("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 84 * 86_400_000).toISOString()).order("starts_at").limit(300),
  ]);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/curriculum">Curriculum</Link>} title="Lesson builder" description="Describe a block of classes; KoryoGraph drafts week-by-week plans using only skills from your library. Edit, then save them as templates or attach them to classes." />
      <LessonBuilder
        programs={(programs ?? []).map((p) => ({ id: p.id, name: p.name, ranks: [...p.ranks].sort((a, b) => a.position - b.position) }))}
        sessions={(sessions ?? []).map((s) => ({ id: s.id, programIds: s.program_ids, label: `${s.name} · ${new Date(s.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` }))} />
    </>
  );
}
