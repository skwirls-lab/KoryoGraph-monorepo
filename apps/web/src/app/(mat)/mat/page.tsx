import Link from "next/link";
import { formatDate } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { cn } from "@koryo/ui/lib/utils";
import { requireSurfacePage } from "@/server/context";
import { todaySessions } from "@/server/queries/mat";

export const metadata = { title: "Today" };

export default async function MatToday() {
  const ctx = await requireSurfacePage("mat");
  const sessions = await todaySessions(ctx);
  const ordered = [...sessions].sort((a, b) => Number(b.mine) - Number(a.mine) || a.starts_at.localeCompare(b.starts_at));
  return (
    <>
      <PageHeader title="Today" description={formatDate(new Date(), ctx.tz, "weekday")} />
      {sessions.length === 0 ? (
        <EmptyState title="No classes today" description="Classes scheduled at your location appear here." />
      ) : (
        <ul className="space-y-3" aria-label="Today's classes">
          {ordered.map((s) => {
            const tag = s.tag;
            return (
              <li key={s.id}>
                <Link href={`/mat/session/${s.id}`} className={cn("flex min-h-20 items-center gap-4 rounded-xl border bg-surface p-4 text-fg no-underline", tag === "Now" ? "border-brand" : "border-default", s.status === "cancelled" && "opacity-60")}>
                  <div className="w-20 shrink-0 text-sm tabular text-fg-secondary">{formatDate(s.starts_at, ctx.tz, "time")}</div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-lg font-semibold", s.status === "cancelled" && "line-through")}>{s.name}</div>
                    <div className="text-sm text-fg-muted">
                      {s.status === "cancelled" ? "Cancelled" : `${s.stats?.attended ?? 0} checked in · ${s.stats?.booked ?? 0} booked${s.capacity ? ` of ${s.capacity}` : ""}`}
                      {s.room ? ` · ${s.room}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {tag ? <Badge className={tag === "Now" ? "" : "bg-elevated text-fg"}>{tag}</Badge> : null}
                    {s.mine ? <Badge variant="outline">Yours</Badge> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
