import Link from "next/link";
import { forbidden } from "next/navigation";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { MONTH_RANGES, ReportHeader, monthsParam } from "@/components/reports/report-header";
import { todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { churnList, monthsBack } from "@/server/queries/growth";

export const metadata = { title: "Churn" };

export default async function ChurnReport({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const months = monthsParam((await searchParams).months);
  const from = `${monthsBack(todayIn(ctx.tz), months - 1)}-01`;
  const rows = ctx.modules.has("billing") && ctx.permissions.has("billing.read") ? await churnList(ctx, from) : null;
  const reasons = new Map<string, number>();
  for (const r of rows ?? []) if (!r.stillMember) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
  return (
    <>
      <ReportHeader title="Churn" description="Memberships cancelled or expired, with the reason given." path="/desk/reports/churn" range={months} ranges={MONTH_RANGES}
        exportHref={`/desk/reports/growth/export?report=churn&months=${months}`} />
      {!rows ? <p className="rounded-xl border border-dashed border-default p-4 text-sm text-fg-secondary">Churn is built from memberships, which need the Billing module and billing access.</p> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <section aria-labelledby="reasons-h" className="rounded-xl border border-default bg-surface p-4">
            <h2 id="reasons-h" className="mb-2 font-semibold">Why they left</h2>
            <p className="mb-2 text-xs text-fg-muted">People who didn&apos;t move to another membership.</p>
            {!reasons.size ? <p className="text-sm text-fg-muted">No one left in this period.</p> : (
              <ul className="space-y-1 text-sm" aria-label="Reasons">{[...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => <li key={r} className="flex justify-between"><span>{r}</span><span className="tabular-nums">{n}</span></li>)}</ul>
            )}
          </section>
          <div className="overflow-x-auto rounded-xl border border-default bg-surface">
            <Table><caption className="sr-only">Ended memberships</caption>
              <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Plan</TableHead><TableHead>Ended</TableHead><TableHead className="text-right">Tenure</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.membershipId}>
                    <TableCell><Link href={`/desk/people/${r.personId}`}>{r.name}</Link>{r.stillMember ? <Badge variant="outline" className="ml-1">still a member</Badge> : null}</TableCell>
                    <TableCell>{r.plan}</TableCell><TableCell>{r.endedOn}</TableCell><TableCell className="text-right tabular">{r.tenureMonths} mo</TableCell><TableCell>{r.reason}</TableCell>
                  </TableRow>
                ))}
                {!rows.length ? <TableRow><TableCell colSpan={5} className="text-center text-fg-muted">No memberships ended in this period.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
