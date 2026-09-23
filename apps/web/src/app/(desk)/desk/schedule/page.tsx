import { addDays, localDate } from "@koryo/scheduling";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { TemplateDialog } from "@/components/schedule/template-dialog";
import { WeekView } from "@/components/schedule/week-view";
import { requireSurfacePage } from "@/server/context";
import { locationScope } from "@/server/queries/locations";
import { scheduleOptions, weekSessions, weekStart } from "@/server/queries/schedule";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string; location?: string; program?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  const [raw, scope] = await Promise.all([searchParams, locationScope(ctx)]);
  // The header's location switcher is the default; the page's own filter overrides it.
  const sp = { ...raw, location: raw.location ?? scope.selected ?? undefined };
  const today = localDate(new Date(), ctx.tz);
  const week = weekStart(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const [options, sessions] = await Promise.all([scheduleOptions(ctx), weekSessions(ctx, week, { location: sp.location, program: sp.program })]);
  const canManage = ctx.permissions.has("schedule.manage");
  const qs = (w: string) => {
    const p = new URLSearchParams({ week: w, ...(sp.location ? { location: sp.location } : {}), ...(sp.program ? { program: sp.program } : {}) });
    return `/desk/schedule?${p.toString()}`;
  };
  const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg";
  return (
    <>
      <PageHeader
        title="Schedule"
        description={`Week of ${new Date(`${week}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/desk/schedule/templates">Classes</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/desk/schedule/holidays">Holidays</Link></Button>
            {canManage ? <TemplateDialog options={options} today={today} trigger={<Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New class</Button>} /> : null}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Button asChild variant="outline" size="icon"><Link href={qs(addDays(week, -7))} aria-label="Previous week"><ChevronLeft className="size-4" /></Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={qs(weekStart(today))}>This week</Link></Button>
        <Button asChild variant="outline" size="icon"><Link href={qs(addDays(week, 7))} aria-label="Next week"><ChevronRight className="size-4" /></Link></Button>
        <form method="get" className="ml-auto flex flex-wrap items-end gap-2">
          <input type="hidden" name="week" value={week} />
          {options.locations.length > 1 ? (
            <label className="flex flex-col gap-1 text-xs text-fg-secondary">Location
              <select name="location" defaultValue={sp.location ?? ""} className={selectClass}>
                <option value="" className="bg-surface">All</option>
                {options.locations.map((l) => <option key={l.id} value={l.id} className="bg-surface">{l.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-fg-secondary">Program
            <select name="program" defaultValue={sp.program ?? ""} className={selectClass}>
              <option value="" className="bg-surface">All</option>
              {options.programs.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
            </select>
          </label>
          <Button type="submit" variant="secondary" size="sm">Filter</Button>
        </form>
      </div>
      {sessions.length === 0 && !sp.program && !sp.location ? (
        <EmptyState title="No classes this week" description={canManage ? "Add a recurring class and its sessions appear here." : "No classes are scheduled this week."} />
      ) : (
        <WeekView week={week} sessions={sessions} timeZone={ctx.tz} today={today} staff={new Map(options.staff.map((s) => [s.id, s.name]))} />
      )}
    </>
  );
}
