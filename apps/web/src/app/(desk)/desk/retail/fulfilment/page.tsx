import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { FulfilmentActions } from "@/components/billing/fulfilment-actions";
import { ModuleLocked } from "@/components/billing/module-locked";
import { RetailTabs } from "@/components/retail/retail-tabs";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Gear fulfilment" };

export default async function FulfilmentPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("retail.sell")) forbidden();
  if (!ctx.modules.has("retail")) return <ModuleLocked title="Gear fulfilment" module="Retail" />;
  const { show } = await searchParams;
  const all = show === "all";
  let q = ctx.supabase.from("v_gear_fulfilments").select("*").order("created_at", { ascending: false }).limit(200);
  if (!all) q = q.neq("status", "delivered");
  const { data: rows } = await q;
  return (
    <>
      <PageHeader title="Retail" description="Enrollment kits to hand out, with the sizes chosen at sign-up."
        actions={<Link href={all ? "/desk/retail/fulfilment" : "/desk/retail/fulfilment?show=all"} className="text-sm">{all ? "Show open only" : "Show delivered too"}</Link>} />
      <RetailTabs current="/desk/retail/fulfilment" />
      {!rows?.length ? <EmptyState title={all ? "No enrollment kits yet" : "Nothing to hand out"} description="Kits appear here when a student enrolls in a plan with gear included." /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Fulfilments">
          {rows.map((f) => (
            <li key={f.id} aria-label={`${f.person_name}: ${f.plan_name ?? "kit"}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/desk/people/${f.person_id}`} className="font-medium">{f.person_name}</Link>
                  <Badge variant={f.status === "delivered" ? "secondary" : f.status === "ready" ? "default" : "outline"}>{f.status}</Badge>
                </div>
                <div className="text-sm text-fg-secondary">
                  {Object.entries((f.sizes ?? {}) as Record<string, string>).map(([item, size]) => `${item}${size ? ` (${size})` : ""}`).join(" · ")}
                </div>
                <div className="text-xs text-fg-muted">{f.household_name}{f.plan_name ? ` · ${f.plan_name}` : ""} · {new Date(f.created_at ?? "").toLocaleDateString("en-US", { timeZone: ctx.tz })}</div>
              </div>
              {f.id && f.status ? <FulfilmentActions id={f.id} status={f.status as "pending" | "ready" | "delivered"} /> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
