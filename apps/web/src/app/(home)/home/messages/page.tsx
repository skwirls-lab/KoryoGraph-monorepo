import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export const metadata = { title: "Messages" };

export default function Page() {
  return (
    <>
      <PageHeader title="Messages" />
      <EmptyState title="No messages yet" description="Messaging with your school arrives in milestone M1." />
    </>
  );
}
