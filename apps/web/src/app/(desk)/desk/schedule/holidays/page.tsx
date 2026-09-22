import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { AddHolidayForm, DeleteHolidayButton } from "@/components/schedule/holiday-controls";
import { requireSurfacePage } from "@/server/context";
import { listHolidays } from "@/server/queries/schedule";

export const metadata = { title: "Holidays" };

export default async function HolidaysPage() {
  const ctx = await requireSurfacePage("desk");
  const holidays = await listHolidays(ctx);
  const canManage = ctx.permissions.has("schedule.manage");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/schedule">Schedule</Link>} title="Holidays" description="Classes don't run on these dates at any location." />
      {canManage ? <div className="mb-6 rounded-xl border border-default bg-surface p-4"><AddHolidayForm /></div> : null}
      {holidays.length === 0 ? <EmptyState title="No upcoming holidays" /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-4 py-2">
              <span className="tabular text-sm text-fg-secondary">{h.date}</span>
              <span className="flex-1">{h.name}{h.locations?.name ? ` · ${h.locations.name}` : ""}</span>
              {canManage ? <DeleteHolidayButton id={h.id} name={h.name} /> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
