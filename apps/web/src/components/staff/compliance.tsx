import "server-only";
import Link from "next/link";
import { Badge } from "@koryo/ui/components/ui/badge";
import { CERT_KINDS } from "@/lib/validation/staff";
import type { Ctx } from "@/server/context";

/** Certifications expired or expiring within 30 days (v_staff_compliance). */
export async function StaffCompliance({ ctx, limit }: { ctx: Ctx; limit?: number }) {
  if (!ctx.permissions.has("staff.manage")) return null;
  let q = ctx.supabase.from("v_staff_compliance").select("id, user_id, staff_name, kind, name, expires_at, days_left, state").order("expires_at");
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return (
    <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="compliance-h">
      <h2 id="compliance-h" className="mb-3 flex items-center justify-between text-base font-semibold">Staff compliance {limit ? <Link href="/desk/staff" className="text-sm font-normal">All staff</Link> : null}</h2>
      {!data?.length ? <p className="text-sm text-fg-muted">No certifications expired or expiring in the next 30 days.</p> : (
        <ul className="divide-y divide-default text-sm" aria-label="Certifications needing attention">
          {data.map((c) => (
            <li key={c.id} aria-label={`${c.staff_name}: ${c.name || CERT_KINDS[c.kind as keyof typeof CERT_KINDS] || c.kind}`} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={`/desk/staff/${c.user_id}`} className="font-medium">{c.staff_name}</Link>
              <span className="text-fg-secondary">{c.name || CERT_KINDS[c.kind as keyof typeof CERT_KINDS] || c.kind}</span>
              <Badge variant={c.state === "expired" ? "destructive" : "outline"} className="ml-auto">
                {c.state === "expired" ? `Expired ${c.expires_at}` : `Expires in ${c.days_left} day${c.days_left === 1 ? "" : "s"}`}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
