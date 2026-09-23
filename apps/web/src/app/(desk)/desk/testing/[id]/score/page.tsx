import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Scoresheets } from "@/components/testing/scoresheet-page";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Scoresheets" };

export default async function ScorePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("testing.manage")) forbidden();
  const { id } = await params;
  const { data: ev } = await ctx.supabase.from("testing_events").select("id, name").eq("id", id).maybeSingle();
  if (!ev) notFound();
  return (
    <>
      <PageHeader eyebrow={<Link href={`/desk/testing/${ev.id}`}>{ev.name}</Link>} title="Scoresheets" description="Your scores as a judge. Any fail → failed; any conditional → conditional pass." />
      <Scoresheets ctx={ctx} eventId={ev.id} />
    </>
  );
}
