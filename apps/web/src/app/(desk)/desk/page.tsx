import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Dashboard" };

export default async function DeskDashboard() {
  const ctx = await requireSurfacePage("desk");
  return (
    <>
      <PageHeader title="Dashboard" description={ctx.tenantName ?? undefined} />
      <EmptyState
        title="Your dashboard fills in as you add students"
        description="Live counts (active students, attendance, trials, revenue) are built in milestone M1. Nothing here is a sample — it will show your school's real numbers."
      />
    </>
  );
}
