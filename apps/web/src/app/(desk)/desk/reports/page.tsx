import Link from "next/link";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Reports" };

const REPORTS = [
  { href: "/desk/reports/roster", title: "Membership roster", description: "Every student with status, programs and ranks, household and recent attendance." },
  { href: "/desk/reports/attendance", title: "Attendance", description: "Weekly attendance totals and by class." },
];

export default async function ReportsPage() {
  await requireSurfacePage("desk");
  return (
    <>
      <PageHeader title="Reports" description="Live from your data; every report exports to CSV." />
      <ul className="grid gap-3 md:grid-cols-2">
        {REPORTS.map((r) => (
          <li key={r.href}><Link href={r.href} className="block rounded-xl border border-default bg-surface p-4 text-fg no-underline hover:border-strong"><h2 className="font-semibold">{r.title}</h2><p className="text-sm text-fg-secondary">{r.description}</p></Link></li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-fg-muted">Revenue, retention, trial funnel and testing reports are added with Billing (M2) and Grow (M3). Ask-in-plain-English reports arrive with Intelligence (M4).</p>
    </>
  );
}
