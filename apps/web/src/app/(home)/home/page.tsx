import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export const metadata = { title: "Home" };

export default function Page() {
  return (
    <>
      <PageHeader title="Home" />
      <EmptyState title="Nothing to show yet" description="Your family's classes, progress and messages appear here once your school adds you (milestone M1)." />
    </>
  );
}
