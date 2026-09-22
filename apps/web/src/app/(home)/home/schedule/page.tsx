import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatDate } from "@koryo/ui/components/app/date-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { BookButton, CancelBookingButton } from "@/components/bookings/booking-buttons";
import { displayName } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { householdStudents } from "@/server/queries/home";

export const metadata = { title: "Schedule" };

export default async function HomeSchedule() {
  const ctx = await requireSurfacePage("home");
  const students = await householdStudents(ctx);
  const ids = students.map((s) => s.id);
  const [{ data: upcoming }, { data: credits }] = await Promise.all([
    ids.length ? ctx.supabase.from("v_upcoming_for_person").select("*").in("person_id", ids).neq("status", "cancelled").order("starts_at") : Promise.resolve({ data: [] }),
    ids.length ? ctx.supabase.from("makeup_credits").select("person_id").in("person_id", ids).is("used_booking_id", null).gt("expires_at", new Date().toISOString()) : Promise.resolve({ data: [] }),
  ]);
  if (students.length === 0) return <><PageHeader title="Schedule" /><EmptyState title="No students yet" /></>;
  return (
    <>
      <PageHeader title="Schedule" description="Upcoming classes for the next three weeks." />
      <div className="space-y-8">
        {students.map((s) => {
          const name = displayName(s);
          const mine = (upcoming ?? []).filter((u) => u.person_id === s.id);
          const creditCount = (credits ?? []).filter((c) => c.person_id === s.id).length;
          return (
            <section key={s.id} aria-label={`${name} schedule`} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">{name}</h2>
                {creditCount ? <Badge variant="secondary">{creditCount} makeup credit{creditCount === 1 ? "" : "s"}</Badge> : null}
              </div>
              {mine.length === 0 ? <p className="text-sm text-fg-muted">No upcoming classes in {name}&apos;s programs.</p> : (
                <ul className="divide-y divide-default rounded-xl border border-default bg-surface">
                  {mine.map((u) => {
                    const label = `${name} into ${u.name} on ${formatDate(u.starts_at as string, ctx.tz, "weekday")}`;
                    const full = u.capacity !== null && (u.taken ?? 0) >= (u.capacity ?? 0);
                    return (
                      <li key={u.session_id} className="flex flex-wrap items-center gap-3 px-4 py-3" aria-label={`${u.name} ${formatDate(u.starts_at as string, ctx.tz, "weekday")}`}>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{u.name}</div>
                          <div className="text-sm text-fg-secondary">{formatDate(u.starts_at as string, ctx.tz, "weekday")} · {formatDate(u.starts_at as string, ctx.tz, "time")}{u.capacity ? ` · ${u.taken}/${u.capacity} spots` : ""}</div>
                        </div>
                        {u.booking_status === "booked" ? <Badge>Booked</Badge> : u.booking_status === "waitlisted" ? <Badge variant="outline">Waitlist #{u.waitlist_position}</Badge> : null}
                        {u.bookable ? (
                          u.booking_id ? <CancelBookingButton bookingId={u.booking_id} sessionId={u.session_id as string} label={label} /> : <BookButton sessionId={u.session_id as string} personId={s.id} full={full} label={label} />
                        ) : <span className="text-xs text-fg-muted">Drop-in — no booking needed</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
