import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export const metadata = { title: "Progress" };

export default function Page() {
  return (
    <>
      <PageHeader title="Progress" />
      <EmptyState title="No progress yet" description="Rank, stripes and requirements appear here once you're enrolled in a program (milestone M1)." />
    </>
  );
}
