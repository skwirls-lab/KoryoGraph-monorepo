import "server-only";
import Link from "next/link";
import { todayIn } from "@/lib/people";
import type { Ctx } from "@/server/context";
import { HoldDialog } from "@/components/billing/membership-actions";
import { TaskDone } from "./task-done";

/** Desk: open tasks (e.g. families' hold requests from Home). */
export async function OpenTasks({ ctx }: { ctx: Ctx }) {
  if (!ctx.permissions.has("people.read")) return null;
  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("id, title, body, due_at, source, related_type, related_id, data, person_id, created_at, people(first_name, last_name)")
    .is("done_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(10);
  const canDo = ctx.permissions.has("people.write");
  const canHold = ctx.permissions.has("billing.charge") && ctx.modules.has("billing");
  return (
    <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="tasks-h">
      <h2 id="tasks-h" className="mb-3 text-base font-semibold">Tasks</h2>
      {!tasks?.length ? <p className="text-sm text-fg-muted">Nothing waiting.</p> : (
        <ul className="divide-y divide-default text-sm" aria-label="Open tasks">
          {tasks.map((t) => {
            const d = (t.data ?? {}) as { kind?: string; from?: string; until?: string };
            return (
              <li key={t.id} aria-label={t.title} className="flex flex-wrap items-center gap-2 py-2">
                {canDo ? <TaskDone taskId={t.id} title={t.title} /> : null}
                <div className="min-w-0 flex-1">
                  <div>{t.person_id ? <Link href={`/desk/people/${t.person_id}?tab=billing`}>{t.title}</Link> : t.title}</div>
                  {t.body ? <div className="text-xs text-fg-secondary">“{t.body}”</div> : null}
                  <div className="text-xs text-fg-muted">{t.source === "request" ? "Requested from Home · " : ""}{t.due_at ? `due ${new Date(t.due_at).toLocaleDateString("en-US", { timeZone: "UTC" })}` : ""}</div>
                </div>
                {d.kind === "hold_request" && canHold && t.related_id && d.from && d.until ? (
                  <HoldDialog membershipId={t.related_id} planName="the membership" today={todayIn(ctx.tz)} initial={{ from: d.from, until: d.until }} taskId={t.id} label="Apply hold" />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
