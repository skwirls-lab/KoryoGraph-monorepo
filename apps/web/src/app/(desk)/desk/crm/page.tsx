import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ModuleLocked } from "@/components/billing/module-locked";
import { NewLeadDialog } from "@/components/crm/lead-forms";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { requireSurfacePage } from "@/server/context";
import { pipeline } from "@/server/queries/crm";

export const metadata = { title: "Pipeline" };

export default async function CrmPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("crm.manage")) forbidden();
  if (!ctx.modules.has("grow")) return <ModuleLocked title="Pipeline" module="Grow" />;
  const [{ stages, leads, sessions }, { data: programs }, { data: tenant }] = await Promise.all([
    pipeline(ctx),
    ctx.supabase.from("programs").select("id, name").eq("active", true).order("sort"),
    ctx.supabase.from("tenants").select("slug").eq("id", ctx.tenantId as string).single(),
  ]);
  return (
    <>
      <PageHeader title="Pipeline" description={`Leads from first contact to member. Public trial form: /s/${tenant?.slug ?? ""}/trial`}
        actions={<div className="flex items-center gap-3"><Link href="/desk/crm/stages" className="text-sm">Stages</Link><NewLeadDialog programs={(programs ?? []).map((p) => ({ value: p.id, label: p.name }))} /></div>} />
      <PipelineBoard stages={stages} leads={leads} sessions={sessions} />
    </>
  );
}
