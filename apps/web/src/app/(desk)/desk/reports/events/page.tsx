import Link from "next/link";
import { forbidden } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { canSeeMoney } from "@/components/reports/money-shell";
import { MONTH_RANGES, ReportHeader, monthsParam } from "@/components/reports/report-header";
import { todayIn } from "@/lib/people";
import { EVENT_KINDS, type EventKind } from "@/lib/validation/events";
import { requireSurfacePage } from "@/server/context";
import { eventRevenue, monthsBack } from "@/server/queries/growth";

export const metadata = { title: "Event revenue" };

export default async function EventRevenueReport({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!canSeeMoney(ctx)) forbidden();
  const months = monthsParam((await searchParams).months, 12);
  const from = `${monthsBack(todayIn(ctx.tz), months - 1)}-01T00:00:00Z`;
  const rows = ctx.modules.has("programs_plus") ? await eventRevenue(ctx, from) : [];
  const m = (c: number) => formatMoney(c, ctx.currency);
  const sum = (k: "invoiced" | "paid" | "outstanding") => rows.reduce((a, r) => a + r[k], 0);
  return (
    <>
      <ReportHeader title="Event revenue" description="Camps, parties, seminars and other events: registrations and what they've invoiced and collected (voided invoices excluded)."
        path="/desk/reports/events" range={months} ranges={MONTH_RANGES} exportHref={`/desk/reports/growth/export?report=events&months=${months}`} />
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <Table><caption className="sr-only">Revenue by event</caption>
          <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Registered</TableHead><TableHead className="text-right">Invoiced</TableHead><TableHead className="text-right">Collected</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.eventId}>
                <TableCell><Link href={`/desk/events/${r.eventId}`}>{r.name}</Link> <span className="text-xs text-fg-muted">{EVENT_KINDS[r.kind as EventKind] ?? r.kind}</span></TableCell>
                <TableCell>{new Date(r.startsAt).toLocaleDateString("en-US", { timeZone: ctx.tz, dateStyle: "medium" })}</TableCell>
                <TableCell className="text-right tabular">{r.registrations}</TableCell><TableCell className="text-right tabular">{m(r.invoiced)}</TableCell>
                <TableCell className="text-right tabular">{m(r.paid)}</TableCell><TableCell className="text-right tabular">{m(r.outstanding)}</TableCell>
              </TableRow>
            ))}
            {!rows.length ? <TableRow><TableCell colSpan={6} className="text-center text-fg-muted">No events in this period.</TableCell></TableRow> : null}
          </TableBody>
          {rows.length ? <TableFooter><TableRow><TableCell colSpan={3}>Total</TableCell><TableCell className="text-right tabular">{m(sum("invoiced"))}</TableCell><TableCell className="text-right tabular">{m(sum("paid"))}</TableCell><TableCell className="text-right tabular">{m(sum("outstanding"))}</TableCell></TableRow></TableFooter> : null}
        </Table>
      </div>
    </>
  );
}
