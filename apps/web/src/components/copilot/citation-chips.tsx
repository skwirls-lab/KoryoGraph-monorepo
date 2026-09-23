import Link from "next/link";
import type { Citation } from "@koryo/ai";

const REPORT_HREF: Record<string, string> = {
  past_due: "/desk/reports/ar-aging", active_students: "/desk/reports/roster", attendance_by_week: "/desk/reports/attendance", mrr: "/desk/reports/mrr", trials: "/desk/reports/funnel",
};

export function citationHref(c: Citation): string {
  switch (c.kind) {
    case "person": return `/desk/people/${c.id}`;
    case "household": return `/desk/households/${c.id}`;
    case "invoice": return `/desk/billing/invoices/${c.id}`;
    case "report": return REPORT_HREF[c.id] ?? "/desk/reports";
    case "kb": return "/desk/settings/knowledge";
    case "approval": return "/desk/inbox/approvals";
  }
}

export function CitationChips({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Sources">
      {citations.map((c, i) => (
        <li key={`${c.kind}-${c.id}-${i}`}>
          <Link href={citationHref(c)} className="inline-flex items-center gap-1 rounded-full border border-default bg-elevated px-2.5 py-0.5 text-xs text-fg no-underline hover:border-strong">
            <span className="text-fg-muted">{c.kind}</span> {c.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
