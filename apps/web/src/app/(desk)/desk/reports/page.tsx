import Link from "next/link";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { canSeeMoney } from "@/components/reports/money-shell";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Reports" };

const REPORTS = [
  { href: "/desk/reports/roster", title: "Membership roster", description: "Every student with status, programs and ranks, household and recent attendance.", money: false },
  { href: "/desk/reports/attendance", title: "Attendance", description: "Weekly attendance totals and by class.", money: false },
  { href: "/desk/reports/funnel", title: "Trial funnel", description: "Leads → trials booked → attended → enrolled, by source and month.", money: false },
  { href: "/desk/reports/retention", title: "Retention cohorts", description: "Share of each joining month still a member, month by month.", money: false },
  { href: "/desk/reports/churn", title: "Churn", description: "Cancelled and expired memberships with reasons and tenure.", money: false },
  { href: "/desk/reports/eligibility", title: "Testing eligibility", description: "Every active student against their next rank's requirements.", money: false },
  { href: "/desk/reports/staff-sessions", title: "Staff sessions", description: "Classes taught per instructor per month.", money: false },
  { href: "/desk/reports/events", title: "Event revenue", description: "Registrations, invoiced and collected per event.", money: true },
  { href: "/desk/reports/revenue", title: "Revenue", description: "Invoiced revenue net of tax by month and GL class.", money: true },
  { href: "/desk/reports/mrr", title: "MRR & churn", description: "Recurring revenue over 12 months, new and churned MRR, ARR.", money: true },
  { href: "/desk/reports/ar-aging", title: "AR aging", description: "Unpaid balances by days past due.", money: true },
  { href: "/desk/reports/payments", title: "Payments & refunds", description: "Money received and refunded, by method.", money: true },
  { href: "/desk/reports/deferred", title: "Deferred revenue", description: "Paid-in-full memberships not yet earned.", money: true },
  { href: "/desk/reports/accounting", title: "Accounting export", description: "QuickBooks/Xero-ready CSVs of sales and payments.", money: true },
];

export default async function ReportsPage() {
  const ctx = await requireSurfacePage("desk");
  const money = canSeeMoney(ctx);
  return (
    <>
      <PageHeader title="Reports" description="Live from your data; every report exports to CSV." />
      <ul className="grid gap-3 md:grid-cols-2">
        {REPORTS.filter((r) => !r.money || money).map((r) => (
          <li key={r.href}><Link href={r.href} className="block rounded-xl border border-default bg-surface p-4 text-fg no-underline hover:border-strong"><h2 className="font-semibold">{r.title}</h2><p className="text-sm text-fg-secondary">{r.description}</p></Link></li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-fg-muted">Ask-in-plain-English reports arrive with Intelligence (M4).</p>
    </>
  );
}
