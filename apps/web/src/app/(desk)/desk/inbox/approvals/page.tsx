import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export const metadata = { title: "Approvals" };

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader title="Approvals" description="Drafts written by KoryoGraph's AI agents wait here for a person to approve." />
      <EmptyState title="No approval queue yet" description="The approval queue ships with the Intelligence module in milestone M4. Nothing is drafted or sent automatically before then." />
    </>
  );
}
