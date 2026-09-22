import type { NextRequest } from "next/server";
import { getOptionalCtx } from "@/server/context";
import { csvResponse } from "@/server/lib/csv";
import { rosterReport } from "@/server/queries/reports";

export async function GET(request: NextRequest) {
  const ctx = await getOptionalCtx();
  if (!ctx?.tenantId || !ctx.permissions.has("reports.read")) return new Response("Forbidden", { status: 403 });
  const rows = await rosterReport(ctx, request.nextUrl.searchParams.get("status") ?? undefined);
  await ctx.supabase.rpc("audit_export", { p_entity: "report:roster", p_rows: rows.length });
  return csvResponse(rows.map((r) => ({ name: r.display_name, status: r.status, dob: r.dob ?? "", email: r.email ?? "", phone: r.phone ?? "", programs: r.programs ?? "", households: r.households ?? "", last_attended: r.last_attended_at ?? "", classes_30d: r.classes_30d })), `roster-${new Date().toISOString().slice(0, 10)}.csv`);
}
