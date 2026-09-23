import "server-only";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import type { Ctx } from "@/server/context";
import { scoresheet } from "@/server/queries/testing";
import { ScoresheetCard } from "./scoresheet-form";

export async function Scoresheets({ ctx, eventId }: { ctx: Ctx; eventId: string }) {
  const rows = await scoresheet(ctx, eventId);
  if (!rows.length) return <EmptyState title="No one to score yet" description="Students appear here once their registration is paid or confirmed." />;
  return <div className="grid gap-4 lg:grid-cols-2">{rows.map((s) => <ScoresheetCard key={s.registrationId} s={s} />)}</div>;
}
