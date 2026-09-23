import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { AddLocation } from "@/components/locations/location-controls";
import { LocationForm } from "@/components/onboarding/steps";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Location" };

export default async function LocationSettings() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const [{ data: loc }, { data: others }] = await Promise.all([
    ctx.supabase.from("locations").select("name, address, phone").eq("is_default", true).maybeSingle(),
    ctx.supabase.from("locations").select("id, name, address").eq("is_default", false).is("archived_at", null).order("name"),
  ]);
  const a = (loc?.address ?? {}) as Record<string, string | undefined>;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="Location" description="Used on receipts, for card readers and on your public trial page." />
      <section className="rounded-xl border border-default bg-surface p-4 sm:p-6">
        <LocationForm initial={{ name: loc?.name ?? "Main location", line1: a.line1 ?? "", line2: a.line2 ?? "", city: a.city ?? "", region: a.region ?? "", postalCode: a.postal_code ?? "", country: a.country ?? "US", phone: loc?.phone ?? "" }} />
      </section>
      <section aria-labelledby="more-loc-h" className="mt-4 rounded-xl border border-default bg-surface p-4 sm:p-6">
        <h2 id="more-loc-h" className="mb-3 text-base font-semibold">Other locations</h2>
        {others?.length ? <ul className="mb-4 text-sm" aria-label="Other locations">{others.map((o) => <li key={o.id}>{o.name} · {((o.address ?? {}) as { line1?: string; city?: string }).line1}, {((o.address ?? {}) as { city?: string }).city}</li>)}</ul> : null}
        {ctx.modules.has("multi_location") ? <AddLocation /> : <p className="text-sm text-fg-secondary">More locations come with the Multi-location module. <Link href="/desk/upgrade">Plans &amp; modules</Link></p>}
      </section>
    </>
  );
}
