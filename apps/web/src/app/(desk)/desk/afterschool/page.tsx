import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { ProgramDialog } from "@/components/afterschool/program-form";
import { WEEKDAYS } from "@/lib/validation/afterschool";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "After-school" };

export default async function AfterschoolPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("events.manage")) forbidden();
  const { data: programs } = await ctx.supabase.from("afterschool_programs").select("id, name, weekly_price_cents, schools, routes, days_of_week, pickup_cutoff, active, afterschool_enrollments(status)").order("name");
  return (
    <>
      <PageHeader title="After-school" description="School pickup manifests by route, daily attendance with signed release, absence alerts and weekly billing."
        actions={<ProgramDialog billing={ctx.modules.has("billing")} />} />
      {!programs?.length ? <EmptyState title="No after-school programs" description="Create one with the schools and routes you pick up from." /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Programs">
          {programs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={`/desk/afterschool/${p.id}`} className="font-medium">{p.name}</Link>
              {!p.active ? <Badge variant="outline">inactive</Badge> : null}
              <span className="text-sm text-fg-secondary">{formatMoney(p.weekly_price_cents, ctx.currency)}/week · {WEEKDAYS.filter((d) => p.days_of_week.includes(d.value)).map((d) => d.short).join(" ")} · cutoff {p.pickup_cutoff.slice(0, 5)}</span>
              <span className="ml-auto text-xs text-fg-muted">{p.afterschool_enrollments.filter((e) => e.status === "active").length} enrolled · {p.schools.length} schools · {p.routes.length} routes</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
