import type { NextRequest } from "next/server";
import { canSeeMoney } from "@/components/reports/money-shell";
import { getOptionalCtx } from "@/server/context";
import { csvResponse } from "@/server/lib/csv";
import { deferredRevenue, fetchAll, mrrHistory, paymentsLedger, reportRange, revenueLines } from "@/server/queries/money";

const GL_ACCOUNT: Record<string, string> = {
  "Membership revenue": "4000 Membership revenue",
  "Fee revenue": "4100 Fee revenue",
  "Retail sales": "4200 Retail sales",
  "Testing fees": "4300 Testing fees",
  "Event revenue": "4400 Event revenue",
  "Adjustments & returns": "4900 Adjustments & returns",
};

const cents = (c: number | null | undefined) => ((c ?? 0) / 100).toFixed(2);

export async function GET(request: NextRequest) {
  const ctx = await getOptionalCtx();
  if (!ctx?.tenantId || !canSeeMoney(ctx)) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const range = reportRange(ctx, sp);
  const stamp = `${range.from}_${range.to}`;
  let rows: Record<string, unknown>[];
  let name: string;
  switch (sp.report) {
    case "revenue":
    case "accounting-lines": {
      const lines = await revenueLines(ctx, range);
      const { data: hh } = await ctx.supabase.from("households").select("id, name");
      const hname = new Map((hh ?? []).map((h) => [h.id, h.name]));
      rows = lines.map((l) => ({
        date: l.issued_on, invoice: l.number, customer: hname.get(l.household_id ?? "") ?? "", account: GL_ACCOUNT[l.gl_class ?? ""] ?? l.gl_class,
        class: l.gl_class, category: l.category, description: l.description, quantity: l.quantity, amount: cents(l.net_cents), tax: cents(l.tax_cents), total: cents(l.total_cents), source: l.source,
      }));
      name = `${sp.report === "revenue" ? "revenue" : "sales"}-${stamp}.csv`;
      break;
    }
    case "payments":
    case "accounting-payments": {
      const ledger = await paymentsLedger(ctx, range);
      rows = ledger.map((p) => ({ date: p.on_date, type: p.kind, customer: p.household_name, invoice: p.invoice_number ?? "", method: p.method, amount: cents(p.amount_cents), reference: p.reference ?? "" }));
      name = `payments-${stamp}.csv`;
      break;
    }
    case "ar": {
      const aging = await fetchAll<{ number: number | null; household_name: string | null; due_at: string | null; days_overdue: number | null; bucket: string | null; total_cents: number | null; balance_cents: number | null }>((a, b) =>
        ctx.supabase.from("v_ar_aging").select("number, household_name, due_at, days_overdue, bucket, total_cents, balance_cents").order("days_overdue", { ascending: false }).range(a, b));
      rows = aging.map((r) => ({ invoice: r.number, customer: r.household_name, due: r.due_at, days_overdue: r.days_overdue, bucket: r.bucket, total: cents(r.total_cents), balance: cents(r.balance_cents) }));
      name = "ar-aging.csv";
      break;
    }
    case "mrr": {
      rows = (await mrrHistory(ctx)).map((r) => ({ month: r.month, mrr: cents(r.mrr_cents), new_mrr: cents(r.new_mrr_cents), churned_mrr: cents(r.churned_mrr_cents), memberships: r.memberships }));
      name = "mrr.csv";
      break;
    }
    case "deferred": {
      rows = (await deferredRevenue(ctx)).map((r) => ({ plan: r.plan_name, started: r.starts_at, months: r.months, paid: cents(r.amount_cents), earned: cents((r.amount_cents ?? 0) - (r.deferred_cents ?? 0)), deferred: cents(r.deferred_cents), as_of: r.as_of }));
      name = "deferred-revenue.csv";
      break;
    }
    default:
      return new Response("Unknown report", { status: 400 });
  }
  await ctx.supabase.rpc("audit_export", { p_entity: `report:${sp.report}`, p_rows: rows.length });
  return csvResponse(rows, name);
}
