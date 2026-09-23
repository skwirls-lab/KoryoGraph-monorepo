import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { CheckinBoard, type CheckinKid } from "@/components/events/checkin-board";
import { SignatureLink } from "@/components/events/event-controls";
import { displayName } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { dayLabel, pickupNames } from "@/server/queries/events";

export const metadata = { title: "Event check-in" };

export default async function EventCheckinPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("events.manage")) forbidden();
  const [{ id }, { day }] = await Promise.all([params, searchParams]);
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(id)) notFound();
  const [{ data: ev }, { data: days }] = await Promise.all([
    ctx.supabase.from("events").select("id, name").eq("id", id).maybeSingle(),
    ctx.supabase.from("event_days").select("id, date").eq("event_id", id).order("date"),
  ]);
  if (!ev || !days?.length) notFound();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz }).format(new Date());
  const current = days.find((d) => d.id === day) ?? days.find((d) => d.date === today) ?? days[0];
  if (!current) notFound();
  const [{ data: regs }, { data: checks }] = await Promise.all([
    ctx.supabase.from("event_registrations").select("person_id, days, people(first_name, last_name, preferred_name, allergies)").eq("event_id", id).in("status", ["registered", "paid", "attended"]),
    ctx.supabase.from("event_checkins").select("person_id, in_at, out_at, pickup_person_name, signature_path").eq("event_day_id", current.id),
  ]);
  const onDay = (regs ?? []).filter((r) => !r.days || r.days.includes(current.id));
  const pickups = await pickupNames(ctx, onDay.map((r) => r.person_id));
  const kids: CheckinKid[] = onDay.map((r) => {
    const c = (checks ?? []).find((x) => x.person_id === r.person_id);
    return {
      personId: r.person_id, name: r.people ? displayName(r.people) : "Student", allergies: r.people?.allergies ?? [], pickups: pickups.get(r.person_id) ?? [],
      inAt: c?.in_at ?? null, outAt: c?.out_at ?? null, pickedUpBy: c?.pickup_person_name ?? null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const signed = (checks ?? []).filter((c) => c.signature_path);
  return (
    <>
      <PageHeader eyebrow={<Link href={`/desk/events/${ev.id}`}>{ev.name}</Link>} title={`Check-in · ${dayLabel(current.date)}`}
        actions={days.length > 1 ? <nav aria-label="Days" className="flex flex-wrap gap-1">{days.map((d) => (
          <Button key={d.id} asChild size="sm" variant={d.id === current.id ? "default" : "outline"}><Link href={`/desk/events/${ev.id}/checkin?day=${d.id}`} aria-current={d.id === current.id ? "page" : undefined}>{dayLabel(d.date)}</Link></Button>
        ))}</nav> : null} />
      {!kids.length ? <p className="text-sm text-fg-muted">No one is registered for this day.</p> : <CheckinBoard dayId={current.id} kids={kids} />}
      {signed.length ? (
        <section aria-labelledby="sig-h" className="mt-6 rounded-xl border border-default bg-surface p-4">
          <h2 id="sig-h" className="mb-2 text-base font-semibold">Pickup log</h2>
          <ul className="text-sm">
            {signed.map((c) => {
              const k = kids.find((x) => x.personId === c.person_id);
              return <li key={c.person_id}>{k?.name}: picked up by {c.pickup_person_name} at {c.out_at ? new Date(c.out_at).toLocaleTimeString("en-US", { timeZone: ctx.tz, timeStyle: "short" }) : ""} · <SignatureLink path={c.signature_path ?? ""} name={k?.name ?? "student"} /></li>;
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
