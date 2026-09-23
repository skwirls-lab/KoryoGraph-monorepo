import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Testing" };

export default async function MatTesting() {
  const ctx = await requireSurfacePage("mat");
  const { data: events } = ctx.permissions.has("testing.manage")
    ? await ctx.supabase.from("testing_events").select("id, name, starts_at").in("status", ["open", "closed"]).order("starts_at").limit(20)
    : { data: [] };
  return (
    <>
      <PageHeader title="Testing" description="Score students on your phone." />
      {!events?.length ? <EmptyState title="No upcoming tests" /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Tests">
          {events.map((e) => <li key={e.id} className="px-4 py-3"><Link href={`/mat/testing/${e.id}`} className="font-medium">{e.name}</Link><div className="text-xs text-fg-muted">{new Date(e.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "medium", timeStyle: "short" })}</div></li>)}
        </ul>
      )}
    </>
  );
}
