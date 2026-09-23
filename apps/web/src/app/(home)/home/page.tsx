import Link from "next/link";
import { formatDate } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { RankBadge } from "@koryo/ui/components/app/rank-badge";
import { displayName } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { householdStudents } from "@/server/queries/home";

export const metadata = { title: "Home" };

export default async function MemberHome() {
  const ctx = await requireSurfacePage("home");
  const students = await householdStudents(ctx);
  const ids = students.map((s) => s.id);
  const [{ data: progress }, { data: upcoming }, { data: unsigned }, { data: threads }, { data: updates }] = await Promise.all([
    ids.length ? ctx.supabase.from("v_enrollment_progress").select("person_id, current_rank_name, current_belt_color, stripes, stripes_max, status").in("person_id", ids).eq("status", "active") : Promise.resolve({ data: [] }),
    ids.length ? ctx.supabase.from("v_upcoming_for_person").select("person_id, name, starts_at, booking_status").in("person_id", ids).neq("status", "cancelled").order("starts_at").limit(50) : Promise.resolve({ data: [] }),
    ids.length ? ctx.supabase.from("v_required_documents").select("person_id").in("person_id", ids).is("signature_id", null) : Promise.resolve({ data: [] }),
    ctx.supabase.from("message_threads").select("id").gt("unread_household", 0),
    ids.length ? ctx.supabase.from("home_updates").select("person_id, week_of, body").in("person_id", ids).order("week_of", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
  ]);
  const { data: invites } = ids.length
    ? await ctx.supabase.from("testing_registrations").select("id, testing_event_id, people(first_name, preferred_name), ranks!testing_registrations_tenant_id_to_rank_id_fkey(name), testing_events(name)").in("person_id", ids).eq("status", "invited")
    : { data: [] };
  return (
    <>
      <PageHeader title="Home" description={ctx.tenantName ?? undefined} />
      <div className="space-y-4">
        {(invites ?? []).map((i) => (
          <Link key={i.id} href={`/home/testing/${i.testing_event_id}`} className="block rounded-xl border border-primary/50 bg-primary/10 p-4 text-fg no-underline">
            <strong>{i.people?.preferred_name || i.people?.first_name} is invited to test for {i.ranks?.name}</strong> — {i.testing_events?.name}. Tap to register.
          </Link>
        ))}
        {unsigned?.length ? (
          <Link href="/home/documents" className="block rounded-xl border border-warning/60 bg-warning/10 p-4 text-fg no-underline">
            <strong>{unsigned.length} form{unsigned.length === 1 ? "" : "s"} to sign</strong> — tap to review.
          </Link>
        ) : null}
        {threads?.length ? (
          <Link href="/home/messages" className="block rounded-xl border border-default bg-surface p-4 text-fg no-underline">
            <strong>{threads.length} new message{threads.length === 1 ? "" : "s"}</strong> from your school.
          </Link>
        ) : null}
        {students.length === 0 ? <EmptyState title="No students yet" description="Your school hasn't added a student to your family yet." /> : (
          <ul className="space-y-3" aria-label="Your students">
            {students.map((s) => {
              const ranks = (progress ?? []).filter((p) => p.person_id === s.id);
              const next = (upcoming ?? []).find((u) => u.person_id === s.id);
              const update = (updates ?? []).find((u) => u.person_id === s.id);
              return (
                <li key={s.id} className="space-y-2 rounded-xl border border-default bg-surface p-4" aria-label={displayName(s)}>
                  <div className="text-lg font-semibold">{displayName(s)}</div>
                  <div className="flex flex-wrap gap-2">
                    {ranks.map((r, i) => r.current_rank_name ? <RankBadge key={i} name={r.current_rank_name} beltColor={r.current_belt_color ?? "#f5f5f5"} stripes={r.stripes ?? 0} stripesMax={r.stripes_max ?? 0} /> : null)}
                  </div>
                  <p className="text-sm text-fg-secondary">
                    {next ? <>Next class: <strong className="text-fg">{next.name}</strong>, {formatDate(next.starts_at as string, ctx.tz, "weekday")} at {formatDate(next.starts_at as string, ctx.tz, "time")}{next.booking_status ? ` · ${next.booking_status}` : ""}</> : "No upcoming classes in the next three weeks."}
                  </p>
                  {update ? (
                    <section aria-label={`This week for ${displayName(s)}`} className="rounded-lg border border-default p-3 text-sm">
                      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">This week · {formatDate(`${update.week_of}T12:00:00Z`, "UTC", "short")}</h3>
                      <p className="whitespace-pre-line">{update.body}</p>
                    </section>
                  ) : null}
                  <div className="flex gap-4 text-sm"><Link href="/home/progress">Progress</Link><Link href="/home/schedule">Schedule</Link></div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
