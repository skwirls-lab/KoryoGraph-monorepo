import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Scoresheets } from "@/components/testing/scoresheet-page";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Scoresheet" };

export default async function MatScore({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("mat");
  if (!ctx.permissions.has("testing.manage")) forbidden();
  const { id } = await params;
  const { data: ev } = await ctx.supabase.from("testing_events").select("id, name").eq("id", id).maybeSingle();
  if (!ev) notFound();
  return (
    <>
      <PageHeader eyebrow={<Link href="/mat/testing">Testing</Link>} title={ev.name} />
      <Scoresheets ctx={ctx} eventId={ev.id} />
    </>
  );
}
