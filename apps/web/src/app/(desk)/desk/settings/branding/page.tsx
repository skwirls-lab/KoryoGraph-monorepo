import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { BrandingForm } from "@/components/onboarding/steps";
import { requireSurfacePage } from "@/server/context";
import { loadShellData } from "@/server/queries/shell";

export const metadata = { title: "Branding" };

export default async function BrandingSettings() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const [{ data: t }, shell] = await Promise.all([ctx.supabase.from("tenants").select("branding").eq("id", ctx.tenantId as string).single(), loadShellData(ctx)]);
  const b = (t?.branding ?? {}) as { theme?: string; logo_path?: string };
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="Branding" description="Your logo appears in the Desk, Mat and Home apps." />
      <section className="rounded-xl border border-default bg-surface p-4 sm:p-6">
        <BrandingForm tenantId={ctx.tenantId as string} theme={b.theme ?? null} logoPath={b.logo_path ?? null} logoUrl={shell.logoUrl} />
      </section>
    </>
  );
}
