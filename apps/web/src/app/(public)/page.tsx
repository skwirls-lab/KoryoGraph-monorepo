import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export default function PublicHome() {
  return (
    <main>
      <PageHeader title="KoryoGraph" description="The operating system for martial arts schools." />
      <EmptyState title="Nothing here yet — built in M1" description="This surface is scaffolded; its features are built in later milestones." />
    </main>
  );
}
