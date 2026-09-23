import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { EVENT_KINDS, PRICE_PER, parsePricing, type EventKind } from "@/lib/validation/events";
import { requireSurfacePage } from "@/server/context";
import { familyPersonIds } from "@/server/queries/events";

export const metadata = { title: "Events" };

export default async function HomeEventsPage() {
  const ctx = await requireSurfacePage("home");
  if (!ctx.modules.has("programs_plus")) return <><PageHeader title="Events" /><EmptyState title="Events aren't available" description="Your school doesn't run event registration here." /></>;
  const family = await familyPersonIds(ctx);
  const [{ data: events }, { data: mine }] = await Promise.all([
    ctx.supabase.from("events").select("id, kind, name, starts_at, pricing, status").neq("kind", "party").in("status", ["open", "closed"]).gte("ends_at", new Date().toISOString()).order("starts_at").limit(50),
    ctx.supabase.from("event_registrations").select("event_id, status, people(first_name, preferred_name)").in("person_id", family).neq("status", "cancelled"),
  ]);
  return (
    <>
      <PageHeader title="Events" description="Camps, seminars and special events." />
      {!events?.length ? <EmptyState title="Nothing coming up" description="New camps and events will appear here." /> : (
        <ul className="space-y-3" aria-label="Events">
          {events.map((e) => {
            const regs = (mine ?? []).filter((r) => r.event_id === e.id);
            const opts = parsePricing(e.pricing);
            return (
              <li key={e.id} className="rounded-xl border border-default bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/home/events/${e.id}`} className="text-base font-semibold">{e.name}</Link>
                  <Badge variant="outline">{EVENT_KINDS[e.kind as EventKind] ?? e.kind}</Badge>
                  {e.status === "closed" ? <Badge variant="secondary">Registration closed</Badge> : null}
                </div>
                <p className="text-sm text-fg-secondary">{new Date(e.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "full", timeStyle: "short" })}{opts[0] ? ` · from ${formatMoney(Math.min(...opts.map((o) => o.price_cents)), ctx.currency)} ${PRICE_PER[opts[0].per]}` : ""}</p>
                {regs.length ? <p className="mt-1 text-sm">Registered: {regs.map((r) => `${r.people?.preferred_name || r.people?.first_name} (${r.status})`).join(", ")}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
