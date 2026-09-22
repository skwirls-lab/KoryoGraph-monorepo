import { addDays, localDate } from "@koryo/scheduling";
import Link from "next/link";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { WeekView } from "@/components/schedule/week-view";
import { requireSurfacePage } from "@/server/context";
import { staffOptions, weekSessions, weekStart } from "@/server/queries/schedule";

export const metadata = { title: "Schedule" };

export default async function MatSchedule({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const ctx = await requireSurfacePage("mat");
  const { week: w } = await searchParams;
  const today = localDate(new Date(), ctx.tz);
  const week = weekStart(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : today);
  const [sessions, staff] = await Promise.all([weekSessions(ctx, week, {}), staffOptions(ctx)]);
  return (
    <>
      <PageHeader title="Schedule" actions={
        <>
          <Button asChild variant="outline" size="sm"><Link href={`/mat/schedule?week=${addDays(week, -7)}`}>Previous</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={`/mat/schedule?week=${addDays(week, 7)}`}>Next</Link></Button>
        </>
      } />
      <WeekView week={week} sessions={sessions} timeZone={ctx.tz} today={today} staff={new Map(staff.map((s) => [s.id, s.name]))} basePath="/mat/session" />
    </>
  );
}
