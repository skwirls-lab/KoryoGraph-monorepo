// The ten heaviest read paths behind the Desk (dashboard, people, progress, risk, billing, reports, rosters).
// Each runs as a signed-in owner (RLS on), as the app runs it. Budgets are ~5–10× the times measured on the
// build host (ADR-0044), so a missing index or a view that stops using one fails the gate.
import type postgres from "postgres";

export const HEAVY: { name: string; budgetMs: number; run: (tx: postgres.Sql) => Promise<unknown> }[] = [
  { name: "dashboard (v_owner_dashboard)", budgetMs: 50, run: (tx) => tx`select * from v_owner_dashboard` },
  { name: "people list (v_member_roster)", budgetMs: 250, run: (tx) => tx`select * from v_member_roster order by last_name, first_name limit 5000` },
  { name: "rank progress (v_enrollment_progress)", budgetMs: 75, run: (tx) => tx`select * from v_enrollment_progress where status = 'active'` },
  { name: "at-risk list (v_risk_latest)", budgetMs: 50, run: (tx) => tx`select * from v_risk_latest where level = 'high' order by score desc` },
  { name: "AR aging (v_ar_aging)", budgetMs: 50, run: (tx) => tx`select * from v_ar_aging` },
  { name: "revenue by month (v_revenue_lines)", budgetMs: 75, run: (tx) => tx`select month, category, sum(net_cents) from v_revenue_lines group by 1, 2` },
  { name: "MRR (v_mrr_monthly)", budgetMs: 75, run: (tx) => tx`select * from v_mrr_monthly` },
  { name: "attendance report (v_attendance_by_class, 12 weeks)", budgetMs: 100, run: (tx) => tx`select week_start, class_name, sessions, attendances from v_attendance_by_class where week_start >= current_date - 84` },
  { name: "retention cohorts (v_retention_cohorts)", budgetMs: 200, run: (tx) => tx`select * from v_retention_cohorts` },
  { name: "tonight's roster (v_class_roster)", budgetMs: 50, run: (tx) => tx`select * from v_class_roster where session_id = (select id from class_sessions where starts_at > now() order by starts_at limit 1)` },
];
