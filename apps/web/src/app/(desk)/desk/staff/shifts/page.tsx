import Link from "next/link";
import { forbidden } from "next/navigation";
import { addDaysStr } from "@koryo/billing";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { DeleteShiftButton, ShiftForm } from "@/components/staff/staff-forms";
import { requireSurfacePage } from "@/server/context";
import { staffList } from "@/server/queries/staff";

export const metadata = { title: "Shifts" };

export default async function ShiftsPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("staff.manage")) forbidden();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz }).format(new Date());
  const [staff, { data: shifts }] = await Promise.all([
    staffList(ctx),
    ctx.supabase.from("shifts").select("id, user_id, starts_at, ends_at, role_label").gte("ends_at", new Date().toISOString()).lte("starts_at", new Date(new Date().getTime() + 15 * 86_400_000).toISOString()).order("starts_at"),
  ]);
  const days = Array.from({ length: 14 }, (_, i) => addDaysStr(today, i));
  const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz }).format(new Date(iso));
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: ctx.tz, timeStyle: "short" });
  const nameOf = (id: string) => staff.find((s) => s.userId === id)?.name ?? "Staff";
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/staff">Staff</Link>} title="Shifts" description="The next two weeks." />
      <section className="mb-4 rounded-xl border border-default bg-surface p-4" aria-label="Add a shift">
        <ShiftForm staff={staff.map((s) => ({ id: s.userId, name: s.name }))} today={today} />
      </section>
      <ol className="space-y-2" aria-label="Shifts by day">
        {days.map((d) => {
          const on = (shifts ?? []).filter((s) => dayOf(s.starts_at) === d);
          return (
            <li key={d} className="rounded-xl border border-default bg-surface p-3">
              <h2 className="text-sm font-semibold">{new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" })}</h2>
              {!on.length ? <p className="text-xs text-fg-muted">No shifts.</p> : (
                <ul className="text-sm">
                  {on.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="w-40">{time(s.starts_at)}–{time(s.ends_at)}</span>
                      <span className="font-medium">{nameOf(s.user_id)}</span>
                      {s.role_label ? <span className="text-fg-secondary">{s.role_label}</span> : null}
                      <span className="ml-auto"><DeleteShiftButton id={s.id} label={`${nameOf(s.user_id)} ${time(s.starts_at)}`} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
