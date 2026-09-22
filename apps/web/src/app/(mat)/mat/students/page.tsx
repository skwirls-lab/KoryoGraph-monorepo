import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export const metadata = { title: "Students" };

export default function Page() {
  return (
    <>
      <PageHeader title="Students" />
      <EmptyState title="Student search arrives in M1" description="Search your students, see ranks, flags and eligibility — built in milestone M1." />
    </>
  );
}
