import Papa from "papaparse";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalCtx } from "@/server/context";
import { listPeople, parsePeopleFilters } from "@/server/queries/people";

/** CSV of the current people list (same filters, no pagination). Readers of the list may export it. */
export async function GET(request: NextRequest) {
  const ctx = await getOptionalCtx();
  if (!ctx) return new NextResponse("Not signed in", { status: 401 });
  if (!ctx.tenantId || !ctx.permissions.has("people.read")) return new NextResponse("Forbidden", { status: 403 });
  const filters = parsePeopleFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { rows } = await listPeople(ctx, filters, true);
  const csv = Papa.unparse(
    rows.map((r) => ({
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      preferred_name: r.preferred_name ?? "",
      status: r.status,
      type: (r.type_flags ?? []).join(" "),
      dob: r.dob ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      households: (r.household_names ?? []).join("; "),
      tags: (r.tags ?? []).join("; "),
      allergies: (r.allergies ?? []).join("; "),
    })),
  );
  await ctx.supabase.rpc("audit_export", { p_entity: "people", p_rows: rows.length });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="people-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
