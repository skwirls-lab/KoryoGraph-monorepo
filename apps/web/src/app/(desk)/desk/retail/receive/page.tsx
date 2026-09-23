import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { IntakeEditor, SlipUpload } from "@/components/retail/intake";
import { RetailTabs } from "@/components/retail/retail-tabs";
import { intakePayloadSchema } from "@/lib/intake";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Receive stock" };

export default async function ReceivePage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("inventory.manage")) forbidden();
  const ai = ctx.modules.has("intelligence");
  const [{ data: pending }, { data: recent }, { data: variants }, { data: suppliers }] = await Promise.all([
    ai ? ctx.supabase.from("approval_items").select("id, title, payload, created_at, ai_transport").eq("kind", "doc_intake").eq("status", "pending").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ai ? ctx.supabase.from("approval_items").select("id, title, status, execution_result, decided_at").eq("kind", "doc_intake").neq("status", "pending").order("decided_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    ctx.supabase.from("product_variants").select("id, sku, options, products(name)").eq("active", true).order("sku"),
    ctx.supabase.from("suppliers").select("id, name").order("name"),
  ]);
  const variantOptions = (variants ?? []).map((v) => ({ id: v.id, label: `${v.products?.name ?? ""}${(v.options as { size?: string } | null)?.size ? ` ${(v.options as { size?: string }).size}` : ""} (${v.sku})` }));
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/retail">Retail</Link>} title="Receive stock"
        description={ai ? "Upload a supplier's packing slip; KoryoGraph reads the lines and matches them to your products. Check the matches, then receive." : "Reading packing slips needs the Intelligence module. Adjust stock by hand in Inventory."}
        actions={ai ? <SlipUpload /> : undefined} />
      <RetailTabs current="/desk/retail/receive" />
      <div className="space-y-4">
        {(pending ?? []).map((it) => {
          const p = intakePayloadSchema.safeParse(it.payload);
          return (
            <section key={it.id} aria-label={it.title} className="rounded-xl border border-default bg-surface p-4">
              <h2 className="mb-3 font-semibold">{it.title}</h2>
              {p.success ? <IntakeEditor id={it.id} initial={p.data} variants={variantOptions} suppliers={suppliers ?? []} fixture={it.ai_transport === "fixture"} /> : <p className="text-sm text-danger">This draft can&apos;t be read.</p>}
            </section>
          );
        })}
        {ai && !pending?.length ? <p className="rounded-xl border border-dashed border-default p-6 text-center text-sm text-fg-secondary">No slips waiting. Upload one to receive stock.</p> : null}
        {recent?.length ? (
          <section aria-labelledby="recv-h" className="rounded-xl border border-default bg-surface p-4">
            <h2 id="recv-h" className="mb-2 font-semibold">Recently received</h2>
            <ul className="divide-y divide-default text-sm" aria-label="Recently received">
              {recent.map((r) => {
                const res = r.execution_result as { ok?: boolean; summary?: string; error?: string } | null;
                return <li key={r.id} className="flex flex-wrap gap-2 py-1.5"><Badge variant={r.status === "approved" ? "secondary" : "outline"}>{r.status}</Badge>{r.title}<span className="text-xs text-fg-muted">{res?.summary ?? res?.error ?? ""}</span></li>;
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
