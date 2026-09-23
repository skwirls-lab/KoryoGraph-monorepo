import Link from "next/link";
import { DateText, formatDate } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { Badge } from "@koryo/ui/components/ui/badge";
import type { Ctx } from "@/server/context";
import { attendanceSummary } from "@/server/queries/activity";

/** 12-week attendance sparkline (single series, labelled) + recent check-ins. */
export async function PersonAttendance({ ctx, personId }: { ctx: Ctx; personId: string }) {
  const { recent, velocity, weekly } = await attendanceSummary(ctx, personId);
  if (!recent.length) return <EmptyState title="No attendance yet" description="Check-ins from the Mat, kiosk or desk appear here." />;
  const weeks = weekly.map((n) => ({ n }));
  const max = Math.max(1, ...weeks.map((w) => w.n));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
      <section className="space-y-3 rounded-xl border border-default bg-surface p-4" aria-label="Attendance summary">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-fg-muted">Last 30 days</dt><dd className="text-xl font-semibold tabular">{velocity?.classes_30d ?? 0}</dd></div>
          <div><dt className="text-fg-muted">30 days before</dt><dd className="text-xl font-semibold tabular">{velocity?.classes_prev_30d ?? 0}</dd></div>
          <div><dt className="text-fg-muted">Weekly streak</dt><dd className="text-xl font-semibold tabular">{velocity?.streak_weeks ?? 0}</dd></div>
          <div><dt className="text-fg-muted">Last class</dt><dd>{velocity?.last_attended_at ? <DateText value={velocity.last_attended_at} timeZone={ctx.tz} /> : "—"}</dd></div>
        </dl>
        <figure aria-label={`Classes per week, last 12 weeks: ${weeks.map((w) => w.n).join(", ")}`}>
          <svg viewBox="0 0 120 32" className="h-12 w-full" role="img" aria-hidden>
            {weeks.map((w, i) => {
              const h = Math.max(1, (w.n / max) * 28);
              return <rect key={i} x={i * 10 + 1} y={30 - h} width={7} height={h} rx={1.5} fill="var(--accent-primary)" />;
            })}
            <line x1="0" y1="30.5" x2="120" y2="30.5" stroke="var(--border-default)" strokeWidth="0.5" />
          </svg>
          <figcaption className="text-xs text-fg-muted">Classes per week, last 12 weeks</figcaption>
        </figure>
      </section>
      <section aria-label="Recent check-ins" className="rounded-xl border border-default bg-surface">
        <ul className="divide-y divide-default">
          {recent.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-28 shrink-0 tabular text-fg-secondary">{formatDate(a.class_sessions?.starts_at ?? a.checked_in_at, ctx.tz, "weekday")}</span>
              <span className="flex-1 truncate">{a.class_sessions?.name ?? "Class"}</span>
              <Badge variant="outline">{a.source.replace("_", " ")}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export async function PersonMessages({ ctx, personId }: { ctx: Ctx; personId: string }) {
  if (!ctx.permissions.has("comms.send")) return <EmptyState title="Messages are visible to staff who can message families" />;
  const { data: hm } = await ctx.supabase.from("household_members").select("household_id").eq("person_id", personId);
  const householdIds = (hm ?? []).map((h) => h.household_id);
  const [{ data: threads }, { data: comms }] = await Promise.all([
    householdIds.length ? ctx.supabase.from("message_threads").select("id, subject, last_message_at, status, unread_staff").in("household_id", householdIds).order("last_message_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    ctx.supabase.from("communications").select("id, channel, status, subject, body_text, template_key, created_at").eq("person_id", personId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!threads?.length && !comms?.length) return <EmptyState title="No messages" description="Conversations with this family and messages sent to this person appear here." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-2" aria-label="Conversations">
        <h3 className="font-semibold">Family conversations</h3>
        {!threads?.length ? <p className="text-sm text-fg-muted">None.</p> : (
          <ul className="divide-y divide-default rounded-xl border border-default bg-surface">
            {threads.map((t) => (
              <li key={t.id}><Link href={`/desk/inbox/${t.id}`} className="flex justify-between gap-2 px-4 py-2 text-sm text-fg no-underline hover:bg-elevated"><span className={t.unread_staff ? "font-semibold" : ""}>{t.subject || "Conversation"}</span><DateText value={t.last_message_at} timeZone={ctx.tz} style="short" className="text-xs text-fg-muted" /></Link></li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2" aria-label="Messages sent">
        <h3 className="font-semibold">Sent to this person</h3>
        {!comms?.length ? <p className="text-sm text-fg-muted">None.</p> : (
          <ul className="divide-y divide-default rounded-xl border border-default bg-surface">
            {comms.map((c) => (
              <li key={c.id} className="px-4 py-2 text-sm">
                <div className="flex justify-between gap-2"><span className="truncate">{c.subject ?? c.body_text}</span><Badge variant="outline">{c.status.replace(/_/g, " ")}</Badge></div>
                <div className="text-xs text-fg-muted">{c.channel} · {c.template_key?.replace(/_/g, " ")} · <DateText value={c.created_at} timeZone={ctx.tz} style="datetime" /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
