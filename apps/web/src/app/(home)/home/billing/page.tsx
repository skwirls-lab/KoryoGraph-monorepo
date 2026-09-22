import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export const metadata = { title: "Billing" };

export default function Page() {
  return (
    <>
      <PageHeader title="Billing" />
      <EmptyState title="No billing yet" description="Invoices, payment methods and autopay arrive with the Billing module (milestone M2)." />
    </>
  );
}
