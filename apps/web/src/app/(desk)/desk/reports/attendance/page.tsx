import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { WeeklyBarChart } from "@/components/reports/weekly-bar-chart";
import { requireSurfacePage } from "@/server/context";
import { attendanceReport } from "@/server/queries/reports";

export const metadata = { title: "Attendance report" };

export default async function AttendanceReport({ searchParams }: { searchParams: Promise<{ weeks?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const weeks = Math.min(52, Math.max(4, Number((await searchParams).weeks ?? 12) || 12));
  const { rows, weekly } = await attendanceReport(ctx, weeks);
  const byClass = new Map<string, { sessions: number; attendances: number }>();
  for (const r of rows) {
    const c = byClass.get(r.class_name ?? "") ?? { sessions: 0, attendances: 0 };
    c.sessions += r.sessions ?? 0;
    c.attendances += r.attendances ?? 0;
    byClass.set(r.class_name ?? "", c);
  }
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/reports">Reports</Link>} title="Attendance" description={`Last ${weeks} weeks`}
        actions={
          <>
            {[8, 12, 26].map((w) => <Button key={w} asChild size="sm" variant={w === weeks ? "secondary" : "ghost"}><Link href={`/desk/reports/attendance?weeks=${w}`}>{w} weeks</Link></Button>)}
            <Button asChild variant="outline" size="sm"><a href={`/desk/reports/attendance/export?weeks=${weeks}`} download>Export CSV</a></Button>
          </>
        } />
      <section className="rounded-xl border border-default bg-surface p-4">
        <h2 className="mb-2 font-semibold">Check-ins per week</h2>
        <WeeklyBarChart data={weekly} unit="check-ins" title={`Check-ins per week, last ${weeks} weeks`} />
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="wk-h">
          <h2 id="wk-h" className="mb-2 font-semibold">By week</h2>
          <div className="overflow-x-auto rounded-xl border border-default bg-surface">
            <Table><caption className="sr-only">Check-ins by week</caption>
              <TableHeader><TableRow><TableHead>Week of</TableHead><TableHead className="text-right">Check-ins</TableHead></TableRow></TableHeader>
              <TableBody>{weekly.map((w) => <TableRow key={w.week}><TableCell>{w.label}</TableCell><TableCell className="text-right tabular">{w.value}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </section>
        <section aria-labelledby="cls-h">
          <h2 id="cls-h" className="mb-2 font-semibold">By class</h2>
          <div className="overflow-x-auto rounded-xl border border-default bg-surface">
            <Table><caption className="sr-only">Attendance by class</caption>
              <TableHeader><TableRow><TableHead>Class</TableHead><TableHead className="text-right">Sessions</TableHead><TableHead className="text-right">Check-ins</TableHead><TableHead className="text-right">Avg</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...byClass.entries()].sort((a, b) => b[1].attendances - a[1].attendances).map(([name, c]) => (
                  <TableRow key={name}><TableCell>{name}</TableCell><TableCell className="text-right tabular">{c.sessions}</TableCell><TableCell className="text-right tabular">{c.attendances}</TableCell><TableCell className="text-right tabular">{c.sessions ? (c.attendances / c.sessions).toFixed(1) : "—"}</TableCell></TableRow>
                ))}
                {byClass.size === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-fg-muted">No classes in this period.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </>
  );
}
