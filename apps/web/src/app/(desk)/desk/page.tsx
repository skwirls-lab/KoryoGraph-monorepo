import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export default function DeskHome() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <PageHeader title="Desk" description="Owner and front-desk workspace." />
      <EmptyState title="Nothing here yet — built in M1" description="This surface is scaffolded; its features are built in later milestones." />
    </main>
  );
}
