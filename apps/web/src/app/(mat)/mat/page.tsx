import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export const metadata = { title: "Today" };

export default function Page() {
  return (
    <>
      <PageHeader title="Today" />
      <EmptyState title="No classes scheduled yet" description="Today's classes and rosters appear here once the schedule is built (milestone M1)." />
    </>
  );
}
