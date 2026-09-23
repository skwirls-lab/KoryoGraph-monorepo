import { locationScope } from "@/server/queries/locations";
import type { NextRequest } from "next/server";
import { getOptionalCtx } from "@/server/context";
import { csvResponse } from "@/server/lib/csv";
import { attendanceReport } from "@/server/queries/reports";

export async function GET(request: NextRequest) {
  const ctx = await getOptionalCtx();
  if (!ctx?.tenantId || !ctx.permissions.has("reports.read")) return new Response("Forbidden", { status: 403 });
  const weeks = Math.min(52, Math.max(4, Number(request.nextUrl.searchParams.get("weeks") ?? 12) || 12));
  const { rows } = await attendanceReport(ctx, weeks, (await locationScope(ctx)).selected);
  await ctx.supabase.rpc("audit_export", { p_entity: "report:attendance", p_rows: rows.length });
  return csvResponse(rows.map((r) => ({ week_start: r.week_start, class: r.class_name, sessions: r.sessions, check_ins: r.attendances })), `attendance-${new Date().toISOString().slice(0, 10)}.csv`);
}
