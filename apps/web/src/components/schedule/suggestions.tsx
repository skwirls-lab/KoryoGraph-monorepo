import "server-only";
import Link from "next/link";
import { Badge } from "@koryo/ui/components/ui/badge";
import type { Ctx } from "@/server/context";
import { SuggestionActions } from "./suggestion-actions";

const KIND: Record<string, string> = { add_section: "Add a section", merge: "Merge", move: "Move", no_show: "No-shows" };

/** A12: the weekly timetable suggestions (open ones), from utilization, waitlists and no-shows. */
export async function ScheduleSuggestions({ ctx }: { ctx: Ctx }) {
  if (!ctx.modules.has("intelligence") || !ctx.permissions.has("schedule.manage")) return null;
  const { data } = await ctx.supabase.from("schedule_suggestions").select("id, kind, title, rationale, week_of, ai_transport")
    .eq("status", "open").order("week_of", { ascending: false }).order("created_at").limit(5);
  return (
    <section className="rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="sched-sugg-h">
      <h2 id="sched-sugg-h" className="mb-3 flex items-center justify-between text-base font-semibold">Schedule suggestions <Link href="/desk/schedule" className="text-sm font-normal">Schedule</Link></h2>
      {!data?.length ? <p className="text-sm text-fg-muted">Nothing to suggest right now. Suggestions are refreshed every Monday from the last 4 weeks of classes.</p> : (
        <ul className="divide-y divide-default text-sm" aria-label="Schedule suggestions">
          {data.map((s) => (
            <li key={s.id} aria-label={s.title} className="space-y-1 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{KIND[s.kind] ?? s.kind}</Badge>
                <span className="font-medium">{s.title}</span>
                {s.ai_transport === "fixture" ? <Badge variant="secondary">dev fixture</Badge> : null}
                <span className="ml-auto"><SuggestionActions id={s.id} title={s.title} /></span>
              </div>
              <p className="text-fg-secondary">{s.rationale}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
