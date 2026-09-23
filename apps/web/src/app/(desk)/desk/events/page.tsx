import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { EVENT_KINDS, type EventKind } from "@/lib/validation/events";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Events" };

const localDate = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("events.manage")) forbidden();
  const { month: m } = await searchParams;
  const today = localDate(new Date().toISOString(), ctx.tz);
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7);
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const [{ data: events }, { data: days }] = await Promise.all([
    ctx.supabase.from("events").select("id, kind, name, starts_at, ends_at, status, capacity, event_registrations(status)")
      .order("starts_at").gte("ends_at", new Date(Date.UTC(y, mo - 2, 20)).toISOString()).lte("starts_at", new Date(Date.UTC(y, mo + 1, 10)).toISOString()).limit(300),
    ctx.supabase.from("event_days").select("event_id, date").gte("date", `${month}-01`).lte("date", `${month}-${String(daysIn).padStart(2, "0")}`),
  ]);
  const { data: upcoming } = await ctx.supabase.from("events").select("id, kind, name, starts_at, status, capacity, event_registrations(status)")
    .gte("ends_at", new Date().toISOString()).neq("status", "cancelled").order("starts_at").limit(50);
  // Which events fall on each date: camp day rows, else every date the event spans.
  const byDate = new Map<string, { id: string; name: string; kind: string }[]>();
  const withDays = new Set((days ?? []).map((d) => d.event_id));
  for (const e of events ?? []) {
    if (e.status === "cancelled") continue;
    const dates = withDays.has(e.id) ? (days ?? []).filter((d) => d.event_id === e.id).map((d) => d.date) : [localDate(e.starts_at, ctx.tz)];
    for (const d of dates) byDate.set(d, [...(byDate.get(d) ?? []), { id: e.id, name: e.name, kind: e.kind }]);
  }
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const regCount = (r: { status: string }[]) => r.filter((x) => x.status !== "cancelled").length;
  return (
    <>
      <PageHeader title="Events" description="Camps, parties, seminars and tournaments: registration, rosters and day check-in."
        actions={<Button asChild size="sm" className="gap-2"><Link href="/desk/events/new"><Plus aria-hidden className="size-4" /> New event</Link></Button>} />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section aria-labelledby="cal-h" className="rounded-xl border border-default bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="cal-h" className="text-base font-semibold">{first.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" })}</h2>
            <span className="ml-auto flex gap-1">
              <Button asChild size="sm" variant="ghost" aria-label="Previous month"><Link href={`/desk/events?month=${shift(-1)}`}><ChevronLeft className="size-4" /></Link></Button>
              <Button asChild size="sm" variant="ghost"><Link href="/desk/events">Today</Link></Button>
              <Button asChild size="sm" variant="ghost" aria-label="Next month"><Link href={`/desk/events?month=${shift(1)}`}><ChevronRight className="size-4" /></Link></Button>
            </span>
          </div>
          <table className="w-full table-fixed border-collapse text-xs" aria-labelledby="cal-h">
            <thead><tr>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <th key={d} scope="col" className="border border-default bg-elevated px-2 py-1 text-left font-medium text-fg-secondary">{d}</th>)}</tr></thead>
            <tbody>
              {weeks.map((w, wi) => (
                <tr key={wi}>
                  {w.map((c, i) => (
                    <td key={c ?? `pad-${wi}-${i}`} className={`h-20 border border-default p-1 align-top ${c === today ? "bg-primary/5" : ""}`}>
                      {c ? <div className={`mb-1 ${c === today ? "font-semibold text-fg" : "text-fg-muted"}`}>{Number(c.slice(8))}</div> : null}
                      {(c ? byDate.get(c) ?? [] : []).slice(0, 3).map((e) => (
                        <Link key={e.id} href={`/desk/events/${e.id}`} className="mb-0.5 block truncate rounded bg-primary/10 px-1 py-0.5 text-fg no-underline">{e.name}</Link>
                      ))}
                      {c && (byDate.get(c)?.length ?? 0) > 3 ? <div className="text-fg-muted">+{(byDate.get(c)?.length ?? 0) - 3} more</div> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section aria-labelledby="up-h" className="rounded-xl border border-default bg-surface p-4">
          <h2 id="up-h" className="mb-3 text-base font-semibold">Upcoming</h2>
          {!upcoming?.length ? <EmptyState title="No upcoming events" description="Create a camp, party or seminar." /> : (
            <ul className="divide-y divide-default text-sm" aria-label="Upcoming events">
              {upcoming.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Link href={`/desk/events/${e.id}`} className="font-medium">{e.name}</Link>
                  <Badge variant="outline">{EVENT_KINDS[e.kind as EventKind] ?? e.kind}</Badge>
                  {e.status !== "open" ? <Badge variant="secondary">{e.status}</Badge> : null}
                  <span className="w-full text-xs text-fg-muted">{new Date(e.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "medium", timeStyle: "short" })} · {regCount(e.event_registrations)} registered{e.capacity ? ` · capacity ${e.capacity}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
