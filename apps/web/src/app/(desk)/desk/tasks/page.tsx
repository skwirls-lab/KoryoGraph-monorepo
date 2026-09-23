import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { AssignSelect, TaskForm } from "@/components/tasks/task-form";
import { TaskDone } from "@/components/tasks/task-done";
import { requireSurfacePage } from "@/server/context";
import { staffList } from "@/server/queries/staff";

export const metadata = { title: "Tasks" };

const VIEWS = { mine: "Mine", queue: "Front desk queue", all: "All open", done: "Done" } as const;
type View = keyof typeof VIEWS;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("people.read")) forbidden();
  const { view: v } = await searchParams;
  const view: View = v && v in VIEWS ? (v as View) : "mine";
  let q = ctx.supabase.from("tasks").select("id, title, body, due_at, done_at, source, assignee_user_id, person_id, people(first_name, last_name), created_at");
  if (view === "done") q = q.not("done_at", "is", null).order("done_at", { ascending: false });
  else {
    q = q.is("done_at", null).order("due_at", { ascending: true, nullsFirst: false }).order("created_at");
    if (view === "mine") q = q.eq("assignee_user_id", ctx.userId ?? "");
    if (view === "queue") q = q.is("assignee_user_id", null);
  }
  const [{ data: tasks }, staff] = await Promise.all([q.limit(200), staffList(ctx)]);
  const canWrite = ctx.permissions.has("people.write");
  const staffOpts = staff.map((s) => ({ id: s.userId, name: s.name }));
  const now = new Date().getTime();
  return (
    <>
      <PageHeader title="Tasks" description="Follow-ups from automations, requests from families and anything you add." />
      {canWrite ? <section className="mb-4 rounded-xl border border-default bg-surface p-4" aria-label="Add a task"><TaskForm staff={staffOpts} /></section> : null}
      <nav aria-label="Task views" className="mb-3 flex flex-wrap gap-1">
        {(Object.keys(VIEWS) as View[]).map((k) => (
          <Link key={k} href={`/desk/tasks?view=${k}`} aria-current={k === view ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm no-underline ${k === view ? "bg-primary text-primary-foreground" : "bg-elevated text-fg-secondary"}`}>{VIEWS[k]}</Link>
        ))}
      </nav>
      {!tasks?.length ? <p className="text-sm text-fg-muted">{view === "mine" ? "Nothing assigned to you." : "Nothing here."}</p> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface text-sm" aria-label="Tasks">
          {tasks.map((t) => {
            const overdue = !t.done_at && t.due_at && new Date(t.due_at).getTime() < now;
            return (
              <li key={t.id} aria-label={t.title} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                {!t.done_at && (canWrite || t.assignee_user_id === ctx.userId) ? <TaskDone taskId={t.id} title={t.title} /> : null}
                <div className="min-w-0 flex-1">
                  <div className={t.done_at ? "text-fg-muted line-through" : ""}>{t.title}</div>
                  <div className="text-xs text-fg-muted">
                    {t.people ? <><Link href={`/desk/people/${t.person_id}`}>{t.people.first_name} {t.people.last_name}</Link> · </> : null}
                    {t.source === "automation" ? "from an automation · " : t.source === "request" ? "requested from Home · " : ""}
                    {t.due_at ? <span className={overdue ? "text-danger" : ""}>due {new Date(t.due_at).toLocaleDateString("en-US", { timeZone: ctx.tz, month: "short", day: "numeric" })}</span> : "no due date"}
                  </div>
                </div>
                {overdue ? <Badge variant="destructive">overdue</Badge> : null}
                {canWrite && !t.done_at ? <AssignSelect taskId={t.id} title={t.title} current={t.assignee_user_id} staff={staffOpts} /> : <span className="text-xs text-fg-muted">{staffOpts.find((s) => s.id === t.assignee_user_id)?.name ?? ""}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
