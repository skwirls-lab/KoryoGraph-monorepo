import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { EventWizard } from "@/components/events/event-wizard";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("events.manage")) forbidden();
  const [{ data: waivers }, { data: households }] = await Promise.all([
    ctx.supabase.from("document_templates").select("id, name").eq("kind", "waiver").eq("active", true).order("name"),
    ctx.supabase.from("households").select("id, name").order("name").limit(1000),
  ]);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/events">Events</Link>} title="New event" />
      <div className="max-w-3xl rounded-xl border border-default bg-surface p-4 sm:p-6">
        <EventWizard waivers={waivers ?? []} households={households ?? []} />
      </div>
    </>
  );
}
