import { describeRule, localDate, weeklyDays } from "@koryo/scheduling";
import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { EndTemplateButton } from "@/components/schedule/end-template-button";
import { TemplateDialog } from "@/components/schedule/template-dialog";
import { requireSurfacePage } from "@/server/context";
import { listTemplates, scheduleOptions } from "@/server/queries/schedule";

export const metadata = { title: "Classes" };

export default async function TemplatesPage() {
  const ctx = await requireSurfacePage("desk");
  const [templates, options] = await Promise.all([listTemplates(ctx), scheduleOptions(ctx)]);
  const today = localDate(new Date(), ctx.tz);
  const canManage = ctx.permissions.has("schedule.manage");
  const programName = new Map(options.programs.map((p) => [p.id, p.name]));
  const staffName = new Map(options.staff.map((s) => [s.id, s.name]));
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/desk/schedule">Schedule</Link>}
        title="Recurring classes"
        actions={canManage ? <TemplateDialog options={options} today={today} trigger={<Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New class</Button>} /> : null}
      />
      {templates.length === 0 ? <EmptyState title="No classes yet" description="Add your first recurring class." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="space-y-1 rounded-xl border border-default bg-surface p-4" aria-label={t.name}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{t.name} {!t.active ? <Badge variant="outline">Ended</Badge> : null}</h2>
                  <p className="text-sm text-fg-secondary">{describeRule(t.rrule, t.start_time)} · {t.duration_min} min{t.capacity ? ` · up to ${t.capacity}` : ""}{t.bookable ? " · bookable" : ""}</p>
                  <p className="text-xs text-fg-muted">
                    {t.program_ids.map((p) => programName.get(p) ?? "Program").join(", ") || "No program"}
                    {t.instructor_ids.length ? ` · ${t.instructor_ids.map((i) => staffName.get(i) ?? "Instructor").join(", ")}` : ""}
                    {` · from ${t.start_date}`}{t.until_date ? ` to ${t.until_date}` : ""}
                  </p>
                </div>
                {canManage && t.active ? (
                  <>
                    <TemplateDialog
                      options={options}
                      today={today}
                      initial={{
                        id: t.id, name: t.name, locationId: t.location_id, programIds: t.program_ids, days: weeklyDays(t.rrule) ?? ["MO"],
                        interval: Number(/INTERVAL=(\d+)/.exec(t.rrule)?.[1] ?? 1), startTime: t.start_time.slice(0, 5), durationMin: t.duration_min,
                        startDate: t.start_date, untilDate: t.until_date ?? "", capacity: t.capacity ?? "", instructorIds: t.instructor_ids,
                        rankMin: t.rank_min_position ?? "", rankMax: t.rank_max_position ?? "", ageMin: t.age_min ?? "", ageMax: t.age_max ?? "",
                        room: t.room ?? "", bookable: t.bookable, cancellationWindowMin: t.cancellation_window_min,
                      }}
                      trigger={<Button variant="ghost" size="icon" aria-label={`Edit ${t.name}`}><Pencil className="size-4" /></Button>}
                    />
                    <EndTemplateButton id={t.id} name={t.name} />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
