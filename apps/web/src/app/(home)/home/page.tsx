import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export default function MemberHome() {
  return (
    <main>
      <PageHeader title="Home" description="Progress, schedule and billing for families." />
      <EmptyState title="Nothing here yet — built in M1" description="This surface is scaffolded; its features are built in later milestones." />
    </main>
  );
}
