import { EmptyState } from "@koryo/ui/components/app/empty-state";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { AutomationToggle } from "@/components/automations/automation-editor";
import { ModuleLocked } from "@/components/billing/module-locked";
import { TRIGGER_KINDS, type TriggerKind } from "@/lib/automations";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("automations.manage") && !ctx.permissions.has("comms.send")) forbidden();
  if (!ctx.modules.has("grow")) return <ModuleLocked title="Automations" module="Grow" />;
  const { data: rows } = await ctx.supabase.from("automations").select("id, name, description, trigger, active, runs, last_run_at").order("name");
  const canEdit = ctx.permissions.has("automations.manage");
  return (
    <>
      <PageHeader title="Automations" description="Messages and tasks that run themselves. Turn on the ones you want."
        actions={canEdit ? <Button asChild size="sm"><Link href="/desk/automations/new" className="no-underline">New automation</Link></Button> : null} />
      {!rows?.length ? <EmptyState title="No automations yet" description="Automations send reminders and create tasks for you — birthday wishes, trial follow-ups, testing reminders." action={canEdit ? <Button asChild><Link href="/desk/automations/new">New automation</Link></Button> : undefined} /> : null}
      <ul className="divide-y divide-default rounded-xl border border-default bg-surface empty:hidden" aria-label="Automations">
        {(rows ?? []).map((a) => {
          const t = a.trigger as { kind: TriggerKind; params?: { days?: number } };
          return (
            <li key={a.id} aria-label={a.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/desk/automations/${a.id}`} className="font-medium">{a.name}</Link>
                <div className="text-sm text-fg-secondary">{a.description}</div>
                <div className="text-xs text-fg-muted">{(TRIGGER_KINDS[t.kind] ?? t.kind).replace("N days", `${t.params?.days ?? "N"} days`)} · {a.runs} run{a.runs === 1 ? "" : "s"}{a.last_run_at ? ` · last ${new Date(a.last_run_at).toLocaleDateString("en-US", { timeZone: ctx.tz })}` : ""}</div>
              </div>
              {canEdit ? <AutomationToggle id={a.id} active={a.active} name={a.name} /> : <span className="text-xs">{a.active ? "On" : "Off"}</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
