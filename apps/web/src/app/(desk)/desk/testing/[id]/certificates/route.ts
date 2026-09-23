import { zipSync } from "fflate";
import { getOptionalCtx } from "@/server/context";

/** All certificates of a test as one ZIP (read under the user's RLS from private storage). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOptionalCtx();
  if (!ctx?.tenantId || !ctx.permissions.has("testing.manage")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const { data: promos } = await ctx.supabase.from("promotions").select("id, certificate_path, enrollments(people(first_name, last_name))").eq("testing_event_id", id).not("certificate_path", "is", null);
  const files: Record<string, Uint8Array> = {};
  for (const p of promos ?? []) {
    const { data } = await ctx.supabase.storage.from("tenant-media").download(p.certificate_path ?? "");
    if (!data) continue;
    const who = `${p.enrollments?.people?.first_name ?? ""}-${p.enrollments?.people?.last_name ?? ""}`.replace(/[^A-Za-z0-9-]+/g, "") || p.id;
    files[`${who}-${p.id.slice(0, 6)}.pdf`] = new Uint8Array(await data.arrayBuffer());
  }
  if (!Object.keys(files).length) return new Response("No certificates yet", { status: 404 });
  return new Response(Buffer.from(zipSync(files)), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="certificates-${id.slice(0, 8)}.zip"` } });
}
