import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export const metadata = { title: "Schedule" };

export default function Page() {
  return (
    <>
      <PageHeader title="Schedule" />
      <EmptyState title="No classes yet" description="Booking and your upcoming classes arrive in milestone M1." />
    </>
  );
}
