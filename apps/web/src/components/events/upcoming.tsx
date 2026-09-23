import "server-only";
import Link from "next/link";
import { EVENT_KINDS, type EventKind } from "@/lib/validation/events";
import type { Ctx } from "@/server/context";

/** Dashboard: the next belt tests and events (whichever the viewer can manage). */
export async function UpcomingEvents({ ctx }: { ctx: Ctx }) {
  const tests = ctx.permissions.has("testing.manage");
  const events = ctx.permissions.has("events.manage") && ctx.modules.has("programs_plus");
  if (!tests && !events) return null;
  const now = new Date().toISOString();
  const [{ data: t }, { data: e }] = await Promise.all([
    tests ? ctx.supabase.from("testing_events").select("id, name, starts_at, testing_registrations(status)").gte("starts_at", now).neq("status", "cancelled").order("starts_at").limit(3) : Promise.resolve({ data: [] }),
    events ? ctx.supabase.from("events").select("id, kind, name, starts_at, event_registrations(status)").gte("ends_at", now).in("status", ["open", "closed"]).order("starts_at").limit(4) : Promise.resolve({ data: [] }),
  ]);
  const items = [
    ...(t ?? []).map((x) => ({ id: x.id, href: `/desk/testing/${x.id}`, name: x.name, kind: "Belt test", at: x.starts_at, n: x.testing_registrations.filter((r) => !["withdrawn", "invited"].includes(r.status)).length })),
    ...(e ?? []).map((x) => ({ id: x.id, href: `/desk/events/${x.id}`, name: x.name, kind: EVENT_KINDS[x.kind as EventKind] ?? x.kind, at: x.starts_at, n: x.event_registrations.filter((r) => r.status !== "cancelled").length })),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 5);
  return (
    <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="upcoming-h">
      <h2 id="upcoming-h" className="mb-3 text-base font-semibold">Coming up</h2>
      {!items.length ? <p className="text-sm text-fg-muted">No belt tests or events scheduled.</p> : (
        <ul className="divide-y divide-default text-sm" aria-label="Upcoming tests and events">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={i.href} className="font-medium">{i.name}</Link>
              <span className="text-xs text-fg-muted">{i.kind} · {new Date(i.at).toLocaleString("en-US", { timeZone: ctx.tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              <span className="ml-auto text-xs text-fg-secondary">{i.n} registered</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
