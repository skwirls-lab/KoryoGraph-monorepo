/**
 * Validates model-written report SQL before it runs (A7). Allowlist-based: one SELECT (or WITH … SELECT),
 * reading only whitelisted views, calling only allowlisted functions, no comments / quoted identifiers /
 * dollar quoting, and LIMIT ≤ 5000 (added when missing). The database repeats the essential checks and runs
 * it as a role that can read nothing else — this is the first line, not the only one.
 */
export const REPORT_VIEWS = {
  v_attendance_weekly: "week_start date, program text, class_name text, sessions int, check_ins int — check-ins per class per week (a class counts for each program it serves)",
  v_members: "display_name, status (active|trial|on_hold|lead|alumni|cancelled|guardian_only), programs text, households text, tags text[], classes_30d int, last_attended_on date, age int",
  v_revenue_monthly: "month date, category text, net_cents int, total_cents int, invoices int — invoiced revenue",
  v_mrr_monthly: "month date, mrr_cents int, new_mrr_cents int, churned_mrr_cents int, memberships int",
  v_payments: "on_date date, kind (payment|refund), method text, amount_cents int, household_name text",
  v_ar_aging: "household_name, bucket (current|1-30|31-60|61-90|90+), balance_cents int, days_overdue int, dunning_stage int, due_at date",
  v_trial_funnel: "period text (YYYY-MM), source text, leads int, trials_booked int, trials_attended int, won int, lost int",
  v_churn: "person_name, plan_name, status, starts_at date, ended_on date, tenure_months int, reason text, still_member bool",
  v_staff_sessions: "staff_name, period text (YYYY-MM), sessions int, hours numeric — classes taught",
  v_risk: "person_name, level (low|medium|high), score int, computed_on date — drift risk",
} as const;

const FUNCTIONS = new Set([
  "count", "sum", "avg", "min", "max", "round", "coalesce", "nullif", "greatest", "least", "date_trunc", "extract", "date_part", "to_char",
  "lower", "upper", "trim", "abs", "floor", "ceil", "now", "age", "concat", "length", "string_agg", "cast", "make_date", "to_date",
]);
/** Words that may precede "(" without being a function call. */
const PAREN_KEYWORDS = new Set(["in", "over", "filter", "as", "exists", "any", "all", "not", "and", "or", "select", "from", "join", "on", "where", "when", "then", "else", "case", "using", "by", "values", "within", "partition"]);
const FORBIDDEN = /\b(insert|update|delete|merge|drop|alter|create|grant|revoke|truncate|copy|call|do|execute|set|reset|vacuum|analyze|lock|listen|notify|into|returning|refresh|comment|security|prepare|deallocate|pg_\w*|set_config|current_setting|dblink\w*|lo_\w*)\b/;

export type SqlCheck = { ok: true; sql: string; views: string[] } | { ok: false; error: string };

export function validateReportSql(input: string, maxLimit = 5000): SqlCheck {
  let sql = input.trim().replace(/;\s*$/, "");
  if (!sql) return { ok: false, error: "The query is empty." };
  if (sql.includes(";")) return { ok: false, error: "Only one statement is allowed." };
  if (/--|\/\*/.test(sql)) return { ok: false, error: "Comments aren't allowed." };
  if (/["`$\\]|u&/i.test(sql)) return { ok: false, error: "Quoted identifiers and escapes aren't allowed." };
  const lower = sql.toLowerCase().replace(/'(?:[^']|'')*'/g, "''"); // ignore string literal contents
  if (!/^\s*(select|with)\b/.test(lower)) return { ok: false, error: "Only SELECT queries are allowed." };
  const forbidden = FORBIDDEN.exec(lower);
  if (forbidden) return { ok: false, error: `“${forbidden[1]}” isn't allowed in a report.` };

  // Relations after FROM / JOIN: CTE names or whitelisted views (optionally nl.-qualified).
  const ctes = new Set([...lower.matchAll(/(?:\bwith|,)\s+([a-z_][a-z0-9_]*)\s+as\s*\(/g)].map((m) => m[1] ?? ""));
  const views = new Set<string>();
  for (const m of lower.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_.]*)/g)) {
    const raw = m[1] ?? "";
    const name = raw.startsWith("nl.") ? raw.slice(3) : raw;
    if (raw.includes(".") && !raw.startsWith("nl.")) return { ok: false, error: `“${raw}” isn't a report view.` };
    if (ctes.has(name) || name === "lateral") continue;
    if (!(name in REPORT_VIEWS)) return { ok: false, error: `“${name}” isn't one of the report views.` };
    views.add(name);
  }
  if (!views.size) return { ok: false, error: "The query doesn't read any report view." };

  // Function calls: word( — must be allowlisted (casts like numeric(10,2) after :: are fine).
  for (const m of lower.matchAll(/(::\s*)?\b([a-z_][a-z0-9_]*)\s*\(/g)) {
    const name = m[2] ?? "";
    if (m[1] || PAREN_KEYWORDS.has(name) || ctes.has(name) || FUNCTIONS.has(name)) continue;
    return { ok: false, error: `The function “${name}” isn't allowed in a report.` };
  }

  const limit = /\blimit\s+(\d+)\s*$/.exec(lower);
  if (limit) {
    if (Number(limit[1]) > maxLimit) return { ok: false, error: `LIMIT can be at most ${maxLimit}.` };
  } else {
    sql = `${sql}\nlimit ${maxLimit}`;
  }
  return { ok: true, sql, views: [...views] };
}
