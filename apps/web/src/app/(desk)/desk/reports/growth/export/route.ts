import type { NextRequest } from "next/server";
import { canSeeMoney } from "@/components/reports/money-shell";
import { todayIn } from "@/lib/people";
import { getOptionalCtx } from "@/server/context";
import { csvResponse } from "@/server/lib/csv";
import { churnList, eligibilityReport, eventRevenue, monthsBack, retentionCohorts, staffSessions, trialFunnel } from "@/server/queries/growth";

const dollars = (c: number) => (c / 100).toFixed(2);

export async function GET(request: NextRequest) {
  const ctx = await getOptionalCtx();
  if (!ctx?.tenantId || !ctx.permissions.has("reports.read")) return new Response("Forbidden", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const n = Number(sp.get("months"));
  const months = [3, 6, 12].includes(n) ? n : 6;
  const today = todayIn(ctx.tz);
  const from = monthsBack(today, months - 1);
  switch (sp.get("report")) {
    case "funnel": {
      if (!ctx.modules.has("grow") || !ctx.permissions.has("crm.manage")) return new Response("Forbidden", { status: 403 });
      const rows = await trialFunnel(ctx, from);
      return csvResponse(rows.map((r) => ({ month: r.period, source: r.source, leads: r.leads, trials_booked: r.booked, trials_attended: r.attended, enrolled: r.won, lost: r.lost })),
        `trial-funnel-${from}.csv`, ["month", "source", "leads", "trials_booked", "trials_attended", "enrolled", "lost"]);
    }
    case "retention": {
      if (!ctx.permissions.has("billing.read")) return new Response("Forbidden", { status: 403 });
      const rows = await retentionCohorts(ctx, monthsBack(today, ([3, 6, 12].includes(n) ? n : 12) - 1));
      return csvResponse(rows.flatMap((c) => c.retained.map((r, k) => ({ cohort: c.cohort, month_index: k, cohort_size: c.size, retained: r, retained_pct: c.size ? (r / c.size * 100).toFixed(1) : "" }))),
        `retention-cohorts.csv`, ["cohort", "month_index", "cohort_size", "retained", "retained_pct"]);
    }
    case "churn": {
      if (!ctx.permissions.has("billing.read")) return new Response("Forbidden", { status: 403 });
      const rows = await churnList(ctx, `${from}-01`);
      return csvResponse(rows.map((r) => ({ member: r.name, plan: r.plan, status: r.status, started: r.startsAt, ended: r.endedOn, tenure_months: r.tenureMonths, reason: r.reason, still_member: r.stillMember ? "yes" : "no" })),
        `churn-${from}.csv`, ["member", "plan", "status", "started", "ended", "tenure_months", "reason", "still_member"]);
    }
    case "eligibility": {
      const rows = await eligibilityReport(ctx);
      return csvResponse(rows.map((r) => ({ student: r.name, program: r.program, current_rank: r.currentRank ?? "", next_rank: r.nextRank ?? "", status: r.status, missing: r.gaps.join("; ") })),
        `testing-eligibility-${today}.csv`, ["student", "program", "current_rank", "next_rank", "status", "missing"]);
    }
    case "staff-sessions": {
      const rows = await staffSessions(ctx, from);
      return csvResponse(rows.map((r) => ({ month: r.period, instructor: r.name, sessions: r.sessions, hours: r.hours.toFixed(2) })), `staff-sessions-${from}.csv`, ["month", "instructor", "sessions", "hours"]);
    }
    case "events": {
      if (!canSeeMoney(ctx)) return new Response("Forbidden", { status: 403 });
      const rows = await eventRevenue(ctx, `${from}-01T00:00:00Z`);
      return csvResponse(rows.map((r) => ({ event: r.name, kind: r.kind, date: r.startsAt.slice(0, 10), registrations: r.registrations, invoiced: dollars(r.invoiced), collected: dollars(r.paid), outstanding: dollars(r.outstanding) })),
        `event-revenue-${from}.csv`, ["event", "kind", "date", "registrations", "invoiced", "collected", "outstanding"]);
    }
    default:
      return new Response("Unknown report", { status: 400 });
  }
}
