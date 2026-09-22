import Link from "next/link";
import { forbidden } from "next/navigation";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { StatusBadge } from "@/components/people/status-badge";
import { requireSurfacePage } from "@/server/context";
import { rosterReport } from "@/server/queries/reports";

export const metadata = { title: "Membership roster" };

export default async function RosterReport({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const { status } = await searchParams;
  const rows = await rosterReport(ctx, status);
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/reports">Reports</Link>} title="Membership roster" description={`${rows.length} students`}
        actions={<Button asChild variant="outline" size="sm"><a href={`/desk/reports/roster/export${status ? `?status=${status}` : ""}`} download>Export CSV</a></Button>} />
      <form method="get" className="mb-4 flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">Status
          <select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg">
            <option value="" className="bg-surface">All</option>
            {["active", "trial", "on_hold", "cancelled", "alumni", "lead"].map((s) => <option key={s} value={s} className="bg-surface">{s.replace("_", " ")}</option>)}
          </select>
        </label>
        <Button type="submit" size="sm" variant="secondary">Filter</Button>
      </form>
      {rows.length === 0 ? <EmptyState title="No students match" /> : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <Table>
            <caption className="sr-only">Membership roster</caption>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Status</TableHead><TableHead>Programs</TableHead><TableHead>Household</TableHead><TableHead>Last attended</TableHead><TableHead className="text-right">Classes (30d)</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.person_id}>
                  <TableCell><Link href={`/desk/people/${r.person_id}`} className="font-medium text-fg">{r.display_name}</Link></TableCell>
                  <TableCell><StatusBadge status={r.status ?? "active"} /></TableCell>
                  <TableCell className="text-sm">{r.programs ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.households ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.last_attended_at ? <DateText value={r.last_attended_at} timeZone={ctx.tz} /> : "—"}</TableCell>
                  <TableCell className="text-right tabular">{r.classes_30d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
