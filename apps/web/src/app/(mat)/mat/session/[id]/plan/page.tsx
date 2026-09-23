import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { LessonBuilder } from "@/components/curriculum/lesson-builder";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Plan this class" };

export default async function PlanClassPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("mat");
  if (!ctx.permissions.has("curriculum.write") || !ctx.modules.has("intelligence")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: s } = await ctx.supabase.from("class_sessions").select("id, name, starts_at, ends_at, program_ids").eq("id", id).maybeSingle();
  if (!s || !s.program_ids[0]) notFound();
  const { data: programs } = await ctx.supabase.from("programs").select("id, name, ranks(position, name)").in("id", s.program_ids);
  return (
    <>
      <PageHeader eyebrow={<Link href={`/mat/session/${id}`}>{s.name}</Link>} title="Plan this class" />
      <LessonBuilder programs={(programs ?? []).map((p) => ({ id: p.id, name: p.name, ranks: p.ranks }))} sessions={[]}
        fixed={{ sessionId: s.id, programId: s.program_ids[0], minutes: Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60_000), label: s.name }} />
    </>
  );
}
