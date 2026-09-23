import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { FailedPayments } from "@/components/billing/failed-payments";
import { ModuleLocked } from "@/components/billing/module-locked";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Failed payments" };

export default async function FailedPaymentsPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("billing.read")) forbidden();
  if (!ctx.modules.has("billing")) return <ModuleLocked title="Failed payments" />;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/billing">Billing</Link>} title="Failed payments" description="Invoices in dunning, oldest failure first." />
      <FailedPayments ctx={ctx} limit={500} />
    </>
  );
}
