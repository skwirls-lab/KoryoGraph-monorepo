import type { NextRequest } from "next/server";
import { getOptionalCtx } from "@/server/context";
import { csvResponse } from "@/server/lib/csv";

/** Registry export (F6.5). `kukkiwon`: black-belt (poom/dan) candidates in the Kukkiwon columns; `generic`: everyone. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOptionalCtx();
  if (!ctx?.tenantId || !ctx.permissions.has("testing.manage")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") === "kukkiwon" ? "kukkiwon" : "generic";
  const [{ data: ev }, { data: regs }] = await Promise.all([
    ctx.supabase.from("testing_events").select("name, starts_at, judges").eq("id", id).maybeSingle(),
    ctx.supabase.from("testing_registrations")
      .select("status, people(first_name, last_name, name_native, nationality, dob, address, photo_path, tcon_id), enrollments(ranks(name)), to_rank:ranks!testing_registrations_tenant_id_to_rank_id_fkey(name)")
      .eq("testing_event_id", id).neq("status", "withdrawn"),
  ]);
  if (!ev) return new Response("Not found", { status: 404 });
  const { data: judges } = ev.judges.length ? await ctx.supabase.from("profiles").select("id, full_name").in("id", ev.judges) : { data: [] };
  const instructor = (judges ?? []).map((j) => j.full_name).filter(Boolean).join("; ");
  const testDate = new Date(ev.starts_at).toLocaleDateString("en-CA", { timeZone: ctx.tz });
  const blackBelt = (rank: string | null | undefined) => Boolean(rank && /\b(dan|poom)\b/i.test(rank));
  const all = regs ?? [];
  const list = format === "kukkiwon" ? all.filter((r) => blackBelt(r.to_rank?.name)) : all;
  const addr = (a: unknown) => { const o = (a ?? {}) as Record<string, string>; return [o.line1, o.line2, o.city, o.region, o.postal_code, o.country].filter(Boolean).join(", "); };
  const rows = list.map((r) => format === "kukkiwon"
    ? {
        name_en: `${r.people?.first_name ?? ""} ${r.people?.last_name ?? ""}`.trim(), name_kr: r.people?.name_native ?? "", nationality: r.people?.nationality ?? "",
        dob: r.people?.dob ?? "", address: addr(r.people?.address), current_poom_dan: r.enrollments?.ranks?.name ?? "", applying_for: r.to_rank?.name ?? "",
        test_date: testDate, instructor, photo_path: r.people?.photo_path ?? "", tcon_id: r.people?.tcon_id ?? "",
      }
    : { name: `${r.people?.first_name ?? ""} ${r.people?.last_name ?? ""}`.trim(), dob: r.people?.dob ?? "", current_rank: r.enrollments?.ranks?.name ?? "", testing_for: r.to_rank?.name ?? "", status: r.status, test_date: testDate });
  await ctx.supabase.rpc("audit_export", { p_entity: `testing:${format}`, p_rows: rows.length });
  const fields = format === "kukkiwon"
    ? ["name_en", "name_kr", "nationality", "dob", "address", "current_poom_dan", "applying_for", "test_date", "instructor", "photo_path", "tcon_id"]
    : ["name", "dob", "current_rank", "testing_for", "status", "test_date"];
  return csvResponse(rows, `${format}-${testDate}.csv`, fields);
}
