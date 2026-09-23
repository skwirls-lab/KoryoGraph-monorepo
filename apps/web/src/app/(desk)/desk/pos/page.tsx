import Link from "next/link";
import { forbidden } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ModuleLocked } from "@/components/billing/module-locked";
import { DrawerControls } from "@/components/pos/drawer-controls";
import { PosRegister } from "@/components/pos/pos-register";
import { requireSurfacePage } from "@/server/context";
import { readyStripe } from "@/server/payments/stripe";

export const metadata = { title: "Point of sale" };

export default async function PosPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("retail.sell")) forbidden();
  if (!ctx.modules.has("retail")) return <ModuleLocked title="Point of sale" module="Retail" />;
  const { location: wanted } = await searchParams;
  const { data: locations } = await ctx.supabase.from("locations").select("id, name, is_default").order("is_default", { ascending: false }).order("name");
  const location = locations?.find((l) => l.id === wanted) ?? locations?.[0];
  if (!location) return <p>Add a location first.</p>;
  const [{ data: drawer }, { data: readers }, { data: recent }, stripe] = await Promise.all([
    ctx.supabase.from("cash_drawers").select("id, opening_cents").eq("location_id", location.id).is("closed_at", null).maybeSingle(),
    ctx.supabase.from("terminal_readers").select("id, label").order("label"),
    ctx.supabase.from("pos_sales").select("id, kind, status, receipt_number, total_cents, created_at, households(name)").eq("location_id", location.id).neq("status", "open").order("created_at", { ascending: false }).limit(8),
    readyStripe(ctx),
  ]);
  const expected = drawer ? ((await ctx.supabase.rpc("pos_drawer_expected", { p_drawer_id: drawer.id })).data ?? drawer.opening_cents) : 0;
  return (
    <>
      <PageHeader title="Point of sale" description={location.name} actions={<DrawerControls locationId={location.id} drawer={drawer ? { id: drawer.id, openingCents: drawer.opening_cents, expectedCents: expected } : null} currency={ctx.currency} />} />
      <PosRegister locationId={location.id} currency={ctx.currency} drawerOpen={Boolean(drawer)} readers={readers ?? []} stripeReady={!("error" in stripe)} />
      <section className="mt-4 rounded-xl border border-default bg-surface p-4" aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-2 text-base font-semibold">Recent sales</h2>
        {!recent?.length ? <p className="text-sm text-fg-muted">No sales yet.</p> : (
          <ul className="divide-y divide-default text-sm" aria-label="Recent sales">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <Link href={`/desk/pos/sales/${s.id}`}>{s.kind === "return" ? "Return" : "Sale"} {s.receipt_number ?? ""}</Link>
                <span className="text-fg-secondary">{s.households?.name ?? "Walk-in"}</span>
                <span className="text-xs text-fg-muted">{s.status}</span>
                <span className="ml-auto tabular">{formatMoney(s.total_cents, ctx.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
