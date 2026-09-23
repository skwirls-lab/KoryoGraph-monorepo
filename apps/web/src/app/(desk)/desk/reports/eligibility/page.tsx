import Link from "next/link";
import { forbidden } from "next/navigation";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { ReportHeader } from "@/components/reports/report-header";
import { requireSurfacePage } from "@/server/context";
import { eligibilityReport } from "@/server/queries/growth";

export const metadata = { title: "Testing eligibility" };

const LABEL = { eligible: "Eligible", almost: "Almost", not_yet: "Not yet" } as const;

export default async function EligibilityReport() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const rows = await eligibilityReport(ctx);
  const programs = [...new Set(rows.map((r) => r.program))];
  return (
    <>
      <ReportHeader title="Testing eligibility" description="Every active student against their next rank's requirements (the same engine as the testing roster)." path="/desk/reports/eligibility" exportHref="/desk/reports/growth/export?report=eligibility" />
      <section aria-label="Summary by program" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {programs.map((p) => {
          const r = rows.filter((x) => x.program === p);
          return (
            <div key={p} className="rounded-xl border border-default bg-surface p-4">
              <h2 className="font-semibold">{p}</h2>
              <p className="text-sm text-fg-secondary">{r.filter((x) => x.status === "eligible").length} eligible · {r.filter((x) => x.status === "almost").length} almost · {r.filter((x) => x.status === "not_yet").length} not yet</p>
            </div>
          );
        })}
        {!programs.length ? <p className="text-sm text-fg-muted">No active enrollments.</p> : null}
      </section>
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <Table><caption className="sr-only">Eligibility by student</caption>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Program</TableHead><TableHead>Rank → next</TableHead><TableHead>Status</TableHead><TableHead>What&apos;s missing</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.filter((r) => r.status !== "not_yet" || r.nextRank).map((r) => (
              <TableRow key={r.enrollmentId}>
                <TableCell><Link href={`/desk/people/${r.personId}?tab=progress`}>{r.name}</Link></TableCell>
                <TableCell>{r.program}</TableCell>
                <TableCell>{r.currentRank ?? "—"} → {r.nextRank ?? "top rank"}</TableCell>
                <TableCell><Badge variant={r.status === "eligible" ? "secondary" : "outline"}>{LABEL[r.status]}</Badge></TableCell>
                <TableCell className="text-xs text-fg-secondary">{r.gaps.join("; ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
