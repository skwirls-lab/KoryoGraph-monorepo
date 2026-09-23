import type { NextRequest } from "next/server";
import { getOptionalCtx } from "@/server/context";
import { csvResponse } from "@/server/lib/csv";
import { isPeriod, payroll } from "@/server/queries/payroll";

const dollars = (c: number) => (c / 100).toFixed(2);

export async function GET(request: NextRequest) {
  const ctx = await getOptionalCtx();
  if (!ctx?.tenantId || !ctx.permissions.has("staff.manage")) return new Response("Forbidden", { status: 403 });
  const period = request.nextUrl.searchParams.get("period") ?? undefined;
  if (!isPeriod(period)) return new Response("Choose a period (YYYY-MM)", { status: 400 });
  const rows = await payroll(ctx, period);
  const fields = ["period", "staff", "hours", "hourly_rate", "hourly_pay", "classes", "per_class_rate", "class_pay", "commissions", "total"];
  return csvResponse(rows.map((r) => ({
    period, staff: r.name, hours: r.hours.toFixed(2), hourly_rate: dollars(r.hourlyCents), hourly_pay: dollars(r.hourlyPayCents), classes: r.sessions,
    per_class_rate: dollars(r.perClassCents), class_pay: dollars(r.classPayCents), commissions: dollars(r.commissionCents), total: dollars(r.totalCents),
  })), `payroll-${period}.csv`, fields);
}
