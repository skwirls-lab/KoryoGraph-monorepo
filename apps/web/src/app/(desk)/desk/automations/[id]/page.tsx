import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { AutomationEditor } from "@/components/automations/automation-editor";
import type { AutomationInput } from "@/lib/automations";
import { requireSurfacePage } from "@/server/context";
import { editorOptions } from "@/server/queries/automations";

export const metadata = { title: "Automation" };

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("automations.manage") || !ctx.modules.has("grow")) forbidden();
  const { id } = await params;
  const opts = await editorOptions(ctx);
  if (id === "new") {
    const initial: AutomationInput = { name: "", description: "", trigger: { kind: "absence", params: { days: 21 } }, conditions: [{ field: "status", op: "in", value: ["active"] }], actions: [{ type: "notify_staff", title: "{{student_name}} needs attention" }], active: false };
    return <><PageHeader eyebrow={<Link href="/desk/automations">Automations</Link>} title="New automation" /><AutomationEditor initial={initial} {...opts} /></>;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: a }, { data: runs }] = await Promise.all([
    ctx.supabase.from("automations").select("*").eq("id", id).maybeSingle(),
    ctx.supabase.from("automation_runs").select("id, status, created_at, updated_at, log, resume_at, people(first_name, last_name, preferred_name)").eq("automation_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (!a) notFound();
  const initial = { id: a.id, name: a.name, description: a.description, trigger: a.trigger, conditions: a.conditions, actions: a.actions, active: a.active } as unknown as AutomationInput;
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/automations">Automations</Link>} title={a.name} description={`${a.runs} completed run${a.runs === 1 ? "" : "s"}`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-label="Editor"><AutomationEditor initial={initial} {...opts} /></section>
        <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="runs-h">
          <h2 id="runs-h" className="mb-3 text-base font-semibold">Run log</h2>
          {!runs?.length ? <p className="text-sm text-fg-muted">No runs yet.</p> : (
            <ul className="divide-y divide-default text-sm" aria-label="Runs">
              {runs.map((r) => {
                const log = (r.log ?? []) as { action: string; result: string }[];
                return (
                  <li key={r.id} className="space-y-1 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.people ? `${r.people.preferred_name || r.people.first_name} ${r.people.last_name}` : "—"}</span>
                      <Badge variant={r.status === "done" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>{r.status}</Badge>
                      <span className="ml-auto text-xs text-fg-muted">{new Date(r.created_at).toLocaleString("en-US", { timeZone: ctx.tz })}{r.resume_at && r.status === "waiting" ? ` · resumes ${new Date(r.resume_at).toLocaleDateString("en-US", { timeZone: ctx.tz })}` : ""}</span>
                    </div>
                    {log.length ? <ol className="text-xs text-fg-secondary">{log.map((l, i) => <li key={i}>{l.action}: {l.result}</li>)}</ol> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
