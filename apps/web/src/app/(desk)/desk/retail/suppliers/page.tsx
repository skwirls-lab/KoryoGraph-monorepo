import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { ModuleLocked } from "@/components/billing/module-locked";
import { RetailTabs } from "@/components/retail/retail-tabs";
import { SupplierDialog } from "@/components/retail/supplier-form";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("inventory.manage")) forbidden();
  if (!ctx.modules.has("retail")) return <ModuleLocked title="Suppliers" module="Retail" />;
  const { data: suppliers } = await ctx.supabase.from("suppliers").select("id, name, contact, notes, active").order("active", { ascending: false }).order("name");
  return (
    <>
      <PageHeader title="Retail" description="Products, stock and suppliers." actions={<SupplierDialog />} />
      <RetailTabs current="/desk/retail/suppliers" />
      {!suppliers?.length ? <EmptyState title="No suppliers yet" description="Keep your vendors' contacts here for reorders." /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Suppliers">
          {suppliers.map((s) => {
            const c = (s.contact ?? {}) as { person?: string; email?: string; phone?: string; website?: string };
            return (
              <li key={s.id} aria-label={s.name} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${s.active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name} {!s.active ? <Badge variant="outline">Inactive</Badge> : null}</div>
                  <div className="text-sm text-fg-secondary">{[c.person, c.email, c.phone, c.website].filter(Boolean).join(" · ") || "No contact details"}</div>
                  {s.notes ? <div className="text-xs text-fg-muted">{s.notes}</div> : null}
                </div>
                <SupplierDialog initial={{ id: s.id, name: s.name, contactName: c.person ?? "", email: c.email ?? "", phone: c.phone ?? "", website: c.website ?? "", notes: s.notes ?? "", active: s.active }} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
