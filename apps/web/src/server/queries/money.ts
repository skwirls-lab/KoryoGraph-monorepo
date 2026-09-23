import "server-only";
import { addDaysStr, addMonthsStr } from "@koryo/billing";
import { todayIn } from "@/lib/people";
import type { Ctx } from "../context";
import { fetchAll } from "../lib/fetch-all";

export { fetchAll };


export interface Range {
  from: string;
  to: string;
}

const isDate = (s: string | undefined): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

/** Default: the last 12 school-local months including this one. */
export function reportRange(ctx: Ctx, sp: { from?: string; to?: string }): Range {
  const today = todayIn(ctx.tz);
  const from = isDate(sp.from) ? sp.from : addMonthsStr(`${today.slice(0, 7)}-01`, -11);
  const to = isDate(sp.to) ? sp.to : today;
  return from <= to ? { from, to } : { from: to, to: from };
}

export interface RevenueRow {
  month: string;
  gl_class: string;
  category: string;
  net_cents: number;
  tax_cents: number;
}

export async function revenueLines(ctx: Ctx, r: Range) {
  return fetchAll<{ month: string | null; issued_on: string | null; invoice_id: string | null; number: number | null; household_id: string | null; gl_class: string | null; category: string | null; kind: string | null; description: string | null; quantity: number | null; net_cents: number | null; tax_cents: number | null; total_cents: number | null; source: string | null }>((a, b) =>
    ctx.supabase.from("v_revenue_lines").select("month, issued_on, invoice_id, number, household_id, gl_class, category, kind, description, quantity, net_cents, tax_cents, total_cents, source")
      .gte("issued_on", r.from).lte("issued_on", r.to).order("issued_on").order("number").range(a, b));
}

/** Revenue by month × GL class (net of tax). */
export async function revenueByMonth(ctx: Ctx, r: Range): Promise<{ months: string[]; classes: string[]; cells: Map<string, number>; tax: number; total: number }> {
  const rows = await revenueLines(ctx, r);
  const cells = new Map<string, number>();
  const months = new Set<string>();
  const classes = new Set<string>();
  let tax = 0;
  let total = 0;
  for (const l of rows) {
    const key = `${l.month}|${l.gl_class}`;
    cells.set(key, (cells.get(key) ?? 0) + (l.net_cents ?? 0));
    months.add(l.month ?? "");
    classes.add(l.gl_class ?? "");
    tax += l.tax_cents ?? 0;
    total += l.net_cents ?? 0;
  }
  return { months: [...months].sort(), classes: [...classes].sort(), cells, tax, total };
}

export async function paymentsLedger(ctx: Ctx, r: Range) {
  return fetchAll<{ kind: string | null; at: string | null; on_date: string | null; method: string | null; amount_cents: number | null; household_name: string | null; invoice_number: number | null; reference: string | null }>((a, b) =>
    ctx.supabase.from("v_payments_ledger").select("kind, at, on_date, method, amount_cents, household_name, invoice_number, reference")
      .gte("on_date", r.from).lte("on_date", r.to).order("at", { ascending: false }).range(a, b));
}

export async function mrrHistory(ctx: Ctx) {
  const { data } = await ctx.supabase.from("v_mrr_monthly").select("month, mrr_cents, new_mrr_cents, churned_mrr_cents, memberships").order("month");
  return data ?? [];
}

export async function deferredRevenue(ctx: Ctx) {
  const { data } = await ctx.supabase.from("v_deferred_revenue").select("membership_id, household_id, plan_name, starts_at, months, amount_cents, deferred_cents, as_of, person_id").order("starts_at", { ascending: false });
  return data ?? [];
}

export function lastDayOf(month: string): string {
  return addDaysStr(addMonthsStr(month, 1), -1);
}
