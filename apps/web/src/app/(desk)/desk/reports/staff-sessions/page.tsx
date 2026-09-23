import Link from "next/link";
import { forbidden } from "next/navigation";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { MONTH_RANGES, ReportHeader, monthLabel, monthsParam } from "@/components/reports/report-header";
import { todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { monthsBack, staffSessions } from "@/server/queries/growth";

export const metadata = { title: "Staff sessions" };

export default async function StaffSessionsReport({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const months = monthsParam((await searchParams).months);
  const from = monthsBack(todayIn(ctx.tz), months - 1);
  const rows = await staffSessions(ctx, from);
  const periods = Array.from({ length: months }, (_, i) => monthsBack(todayIn(ctx.tz), months - 1 - i));
  const staff = [...new Map(rows.map((r) => [r.userId, r.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const cell = (u: string, p: string) => rows.find((r) => r.userId === u && r.period === p)?.sessions ?? 0;
  return (
    <>
      <ReportHeader title="Staff sessions" description="Classes taught per instructor per month (a substitute teaches instead of the scheduled instructor; cancelled classes don't count)."
        path="/desk/reports/staff-sessions" range={months} ranges={MONTH_RANGES} exportHref={`/desk/reports/growth/export?report=staff-sessions&months=${months}`} />
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <Table><caption className="sr-only">Classes taught by month</caption>
          <TableHeader><TableRow><TableHead>Instructor</TableHead>{periods.map((p) => <TableHead key={p} className="text-right">{monthLabel(p)}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {staff.map(([u, name]) => (
              <TableRow key={u} aria-label={name}>
                <TableCell>{ctx.permissions.has("staff.manage") ? <Link href={`/desk/staff/${u}`}>{name}</Link> : name}</TableCell>
                {periods.map((p) => <TableCell key={p} className="text-right tabular">{cell(u, p)}</TableCell>)}
                <TableCell className="text-right font-semibold tabular">{periods.reduce((a, p) => a + cell(u, p), 0)}</TableCell>
              </TableRow>
            ))}
            {!staff.length ? <TableRow><TableCell colSpan={periods.length + 2} className="text-center text-fg-muted">No classes taught in this period.</TableCell></TableRow> : null}
          </TableBody>
          {staff.length ? <TableFooter><TableRow><TableCell>Total</TableCell>{periods.map((p) => <TableCell key={p} className="text-right tabular">{staff.reduce((a, [u]) => a + cell(u, p), 0)}</TableCell>)}<TableCell className="text-right tabular">{rows.reduce((a, r) => a + r.sessions, 0)}</TableCell></TableRow></TableFooter> : null}
        </Table>
      </div>
    </>
  );
}
