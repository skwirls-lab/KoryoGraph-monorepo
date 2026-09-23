import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { StageRow } from "@/components/crm/lead-forms";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Pipeline stages" };

export default async function StagesPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("crm.manage") || !ctx.modules.has("grow")) forbidden();
  const { data: stages } = await ctx.supabase.from("pipeline_stages").select("id, name, position, kind, key").order("position");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/crm">Pipeline</Link>} title="Stages" description="Rename and reorder stages. Built-in stages drive trials (Trial scheduled/attended), Won and Lost." />
      <div className="max-w-xl space-y-2 rounded-xl border border-default bg-surface p-4">
        {(stages ?? []).map((s) => <StageRow key={s.id} id={s.id} name={s.name} position={s.position} />)}
        <div className="border-t border-default pt-2"><StageRow name="" position={((stages ?? []).at(-3)?.position ?? 50) + 5} /></div>
      </div>
    </>
  );
}
