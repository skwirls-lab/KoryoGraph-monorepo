import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { LocationForm } from "@/components/onboarding/steps";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Location" };

export default async function LocationSettings() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const { data: loc } = await ctx.supabase.from("locations").select("name, address, phone").eq("is_default", true).maybeSingle();
  const a = (loc?.address ?? {}) as Record<string, string | undefined>;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="Location" description="Used on receipts, for card readers and on your public trial page." />
      <section className="rounded-xl border border-default bg-surface p-4 sm:p-6">
        <LocationForm initial={{ name: loc?.name ?? "Main location", line1: a.line1 ?? "", line2: a.line2 ?? "", city: a.city ?? "", region: a.region ?? "", postalCode: a.postal_code ?? "", country: a.country ?? "US", phone: loc?.phone ?? "" }} />
      </section>
    </>
  );
}
