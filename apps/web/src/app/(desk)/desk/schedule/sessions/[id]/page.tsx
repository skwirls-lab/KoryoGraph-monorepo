import Link from "next/link";
import { notFound } from "next/navigation";
import { DateText, formatDate } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { RankBadge } from "@koryo/ui/components/app/rank-badge";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { CancelBookingButton } from "@/components/bookings/booking-buttons";
import { BookPersonDialog, CancelSessionDialog, CheckInSwitch, InstructorPicker, SessionNote } from "@/components/schedule/session-controls";
import { requireSurfacePage } from "@/server/context";
import { getClassSession, staffOptions } from "@/server/queries/schedule";

export const metadata = { title: "Session" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, staff] = await Promise.all([getClassSession(ctx, id), staffOptions(ctx)]);
  if (!data) notFound();
  const { session: s, roster, communications } = data;
  const canManage = ctx.permissions.has("schedule.manage");
  const canAttend = ctx.permissions.has("attendance.write");
  const cancelled = s.status === "cancelled";
  const booked = roster.filter((r) => r.booking_status === "booked" || r.booking_status === "attended");
  const waitlisted = roster.filter((r) => r.booking_status === "waitlisted").sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0));
  const present = roster.filter((r) => r.attended).length;
  const { data: bookingRows } = await ctx.supabase.from("bookings").select("id, person_id").eq("session_id", s.id).neq("status", "cancelled");
  const bookingIds = new Map((bookingRows ?? []).map((b) => [b.person_id, b.id]));
  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/desk/schedule?week=${s.occurrence_date}`}>Schedule</Link>}
        title={s.name}
        description={<>{formatDate(s.starts_at, ctx.tz, "weekday")} · {formatDate(s.starts_at, ctx.tz, "time")}–{formatDate(s.ends_at, ctx.tz, "time")} · {s.locations?.name}{s.room ? ` · ${s.room}` : ""}</>}
        actions={canManage && !cancelled ? <CancelSessionDialog sessionId={s.id} name={s.name} /> : null}
      />
      {cancelled ? <p role="status" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm">This session is cancelled{s.cancel_reason ? ` — ${s.cancel_reason}` : ""}.</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2" aria-labelledby="roster-h">
          <div className="flex items-baseline justify-between">
            <h2 id="roster-h" className="text-lg font-semibold">Roster</h2>
            <div className="flex items-center gap-2">{canAttend && !cancelled ? <BookPersonDialog sessionId={s.id} /> : null}</div>
            <p className="text-sm text-fg-secondary tabular">{present} present · {booked.length}{s.capacity ? `/${s.capacity}` : ""} booked{waitlisted.length ? ` · ${waitlisted.length} waitlisted` : ""}</p>
          </div>
          {roster.length === 0 ? <EmptyState title="No one on this roster" description="Students enrolled in this class's programs appear here." /> : (
            <div className="overflow-x-auto rounded-xl border border-default bg-surface">
              <Table>
                <caption className="sr-only">Roster for {s.name}</caption>
                <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Rank</TableHead><TableHead>Booking</TableHead><TableHead className="text-right">Present</TableHead></TableRow></TableHeader>
                <TableBody>
                  {roster.map((r) => (
                    <TableRow key={r.person_id}>
                      <TableCell>
                        <Link href={`/desk/people/${r.person_id}`} className="font-medium text-fg">{r.display_name}</Link>
                        {r.allergies?.length ? <span className="ml-2 text-xs text-warning">allergy: {r.allergies.join(", ")}</span> : null}
                      </TableCell>
                      <TableCell>{r.rank_name ? <RankBadge name={r.rank_name} beltColor={r.belt_color ?? "#f5f5f5"} stripes={r.stripes ?? 0} stripesMax={r.stripes_max ?? 0} /> : <span className="text-fg-muted">—</span>}</TableCell>
                      <TableCell>
                        {r.booking_status ? <Badge variant="outline" className="capitalize">{r.booking_status}{r.waitlist_position ? ` #${r.waitlist_position}` : ""}</Badge> : <span className="text-xs text-fg-muted">{r.is_extra ? "walk-in" : "enrolled"}</span>}
                        {canAttend && !cancelled && (r.booking_status === "booked" || r.booking_status === "waitlisted") && bookingIds.get(r.person_id as string) ? (
                          <CancelBookingButton bookingId={bookingIds.get(r.person_id as string) as string} sessionId={s.id} label={`booking for ${r.display_name}`} />
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{canAttend ? <CheckInSwitch sessionId={s.id} personId={r.person_id as string} name={r.display_name ?? ""} present={Boolean(r.attended)} disabled={cancelled} /> : r.attended ? "✓" : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
        <aside className="space-y-4">
          {canManage ? <section className="rounded-xl border border-default bg-surface p-4"><InstructorPicker sessionId={s.id} staff={staff} current={s.instructor_ids} /></section> : null}
          {canAttend ? <section className="rounded-xl border border-default bg-surface p-4"><SessionNote sessionId={s.id} initial={s.notes ?? ""} /></section> : null}
          {communications.length ? (
            <section className="rounded-xl border border-default bg-surface p-4" aria-labelledby="comms-h">
              <h2 id="comms-h" className="mb-2 text-base font-semibold">Messages about this session</h2>
              <ul className="space-y-1 text-sm" aria-label="Messages about this session">
                {communications.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{c.channel} → {c.to_address ?? "—"}</span>
                    <span className="shrink-0 text-xs text-fg-muted">{c.status.replace(/_/g, " ")} · <DateText value={c.created_at} timeZone={ctx.tz} style="time" /></span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-fg-muted">&quot;unsent no provider&quot; = no email/SMS provider is configured; see the Outbox.</p>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
