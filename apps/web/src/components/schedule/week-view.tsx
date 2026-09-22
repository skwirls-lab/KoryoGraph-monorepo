import { addDays, parseDate } from "@koryo/scheduling";
import Link from "next/link";
import { formatDate } from "@koryo/ui/components/app/date-text";
import { cn } from "@koryo/ui/lib/utils";
import type { WeekSession } from "@/server/queries/schedule";

export function WeekView({ week, sessions, timeZone, today, staff, basePath = "/desk/schedule/sessions" }: {
  week: string; sessions: WeekSession[]; timeZone: string; today: string; staff: Map<string, string>; basePath?: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  return (
    <div className="grid gap-3 md:grid-cols-7" role="list" aria-label="Week">
      {days.map((d) => {
        const list = sessions.filter((s) => s.localDate === d);
        const { year, month, day } = parseDate(d);
        const label = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
        return (
          <section key={d} role="listitem" aria-label={label} className={cn("min-w-0 rounded-xl border border-default bg-surface p-2", d === today && "border-brand/60")}>
            <h2 className={cn("px-1 pb-2 text-sm font-semibold", d === today && "text-brand-text")}>{label}</h2>
            {list.length === 0 ? <p className="px-1 text-xs text-fg-muted">No classes</p> : null}
            <ul className="space-y-2">
              {list.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`${basePath}/${s.id}`}
                    className={cn(
                      "block rounded-lg border border-default bg-elevated p-2 text-fg no-underline hover:border-strong",
                      s.status === "cancelled" && "opacity-60",
                    )}
                    aria-label={`${s.name} ${formatDate(s.startsAt, timeZone, "time")}${s.status === "cancelled" ? " cancelled" : ""}`}
                  >
                    <div className="text-xs tabular text-fg-secondary">{formatDate(s.startsAt, timeZone, "time")}–{formatDate(s.endsAt, timeZone, "time")}</div>
                    <div className={cn("text-sm font-medium", s.status === "cancelled" && "line-through")}>{s.name}</div>
                    <div className="text-xs text-fg-muted">
                      {s.status === "cancelled" ? "Cancelled" : (
                        <>
                          {s.capacity ? `${s.booked}/${s.capacity} booked` : `${s.booked} booked`}
                          {s.waitlisted ? ` · ${s.waitlisted} waitlist` : ""}
                          {s.attended ? ` · ${s.attended} in` : ""}
                        </>
                      )}
                    </div>
                    {s.instructorIds.length ? <div className="truncate text-xs text-fg-muted">{s.instructorIds.map((i) => staff.get(i) ?? "Instructor").join(", ")}</div> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
