import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { addDaysStr } from "@koryo/billing";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { ManifestBoard } from "@/components/afterschool/manifest-board";
import { PrintButton } from "@/components/common/print-button";
import { requireSurfacePage } from "@/server/context";
import { manifest } from "@/server/queries/afterschool";

export const metadata = { title: "Pickup manifest" };

export default async function ManifestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("events.manage")) forbidden();
  const [{ id }, { date: d }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz }).format(new Date());
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  const { data: p } = await ctx.supabase.from("afterschool_programs").select("id, name, pickup_cutoff").eq("id", id).maybeSingle();
  if (!p) notFound();
  const kids = await manifest(ctx, p.id, date);
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "full" });
  return (
    <>
      <PageHeader eyebrow={<Link href={`/desk/afterschool/${p.id}`}>{p.name}</Link>} title={`Pickup manifest · ${label}`}
        description={`${kids.length} expected · ${kids.filter((k) => k.absent).length} absent · cutoff ${p.pickup_cutoff.slice(0, 5)}`}
        actions={<nav aria-label="Day" className="flex flex-wrap gap-1 print:hidden">
          <Button asChild size="sm" variant="outline"><Link href={`?date=${addDaysStr(date, -1)}`}>Previous day</Link></Button>
          {date !== today ? <Button asChild size="sm" variant="outline"><Link href={`?date=${today}`}>Today</Link></Button> : null}
          <Button asChild size="sm" variant="outline"><Link href={`?date=${addDaysStr(date, 1)}`}>Next day</Link></Button>
          <PrintButton />
        </nav>} />
      {!kids.length ? <p className="text-sm text-fg-muted">No one is expected this day.</p> : <ManifestBoard date={date} kids={kids} tz={ctx.tz} />}
    </>
  );
}
