import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { ConvertButton, LeadNoteForm, NextActionForm } from "@/components/crm/lead-forms";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Lead" };
const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("crm.manage") || !ctx.modules.has("grow")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: l } = await ctx.supabase.from("leads")
    .select("*, pipeline_stages(name, kind), people(id, first_name, last_name, email, phone, source, utm), bookings(status, class_sessions(name, starts_at)), lead_activities(id, kind, body, at), tasks(id, title, due_at, done_at)")
    .eq("id", id).maybeSingle();
  if (!l) notFound();
  const { data: programs } = l.program_interest.length ? await ctx.supabase.from("programs").select("name").in("id", l.program_interest) : { data: [] };
  const utm = { ...((l.people?.utm ?? {}) as Record<string, string>), ...((l.utm ?? {}) as Record<string, string>) };
  const activities = [...(l.lead_activities ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "medium", timeStyle: "short" });
  const name = l.people ? `${l.people.first_name} ${l.people.last_name}`.trim() : "Lead";
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/crm">Pipeline</Link>} title={name}
        description={<span className="inline-flex items-center gap-2"><Badge variant="outline">{l.pipeline_stages?.name}</Badge>{l.lost_reason ? `Lost: ${l.lost_reason}` : null}{l.converted_household_id ? <Link href={`/desk/households/${l.converted_household_id}`}>Member household</Link> : null}</span>}
        actions={!l.converted_household_id && !l.lost_reason ? <ConvertButton leadId={l.id} /> : null} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className={card} aria-labelledby="next-h">
            <h2 id="next-h" className="mb-3 text-base font-semibold">Next action</h2>
            <NextActionForm leadId={l.id} text={l.next_action ?? ""} at={l.next_action_at?.slice(0, 10) ?? ""} />
          </section>
          <section className={card} aria-labelledby="act-h">
            <h2 id="act-h" className="mb-3 text-base font-semibold">Activity</h2>
            <LeadNoteForm leadId={l.id} />
            <ol className="mt-4 space-y-2 text-sm" aria-label="Activity">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-2"><span className="w-40 shrink-0 text-xs text-fg-muted">{fmt(a.at)}</span><span><Badge variant="outline" className="mr-1">{a.kind.replace("_", " ")}</Badge>{a.body}</span></li>
              ))}
            </ol>
          </section>
        </div>
        <div className="space-y-4">
          <section className={`${card} text-sm`} aria-labelledby="contact-h">
            <h2 id="contact-h" className="mb-2 text-base font-semibold">Contact</h2>
            <dl className="space-y-1">
              <div><dt className="inline text-fg-secondary">Email </dt><dd className="inline">{l.people?.email ?? "—"}</dd></div>
              <div><dt className="inline text-fg-secondary">Phone </dt><dd className="inline">{l.people?.phone ?? "—"}</dd></div>
              <div><dt className="inline text-fg-secondary">Source </dt><dd className="inline">{l.source ?? l.people?.source ?? "—"}</dd></div>
              {Object.entries(utm).map(([k, v]) => <div key={k}><dt className="inline text-fg-secondary">{k} </dt><dd className="inline">{v}</dd></div>)}
              <div><dt className="inline text-fg-secondary">Interested in </dt><dd className="inline">{(programs ?? []).map((p) => p.name).join(", ") || "—"}</dd></div>
              {l.message ? <div><dt className="text-fg-secondary">Message</dt><dd>{l.message}</dd></div> : null}
            </dl>
            {l.people ? <p className="mt-2"><Link href={`/desk/people/${l.people.id}`}>Open profile</Link></p> : null}
          </section>
          <section className={`${card} text-sm`} aria-labelledby="trial-h">
            <h2 id="trial-h" className="mb-2 text-base font-semibold">Trial</h2>
            {l.bookings?.class_sessions ? <p>{l.bookings.class_sessions.name}, {fmt(l.bookings.class_sessions.starts_at)} — <span className="capitalize">{l.bookings.status}</span></p> : <p className="text-fg-muted">No trial booked. Drag the card to Trial scheduled to book one.</p>}
          </section>
          <section className={`${card} text-sm`} aria-labelledby="tasks-h">
            <h2 id="tasks-h" className="mb-2 text-base font-semibold">Tasks</h2>
            {!l.tasks?.length ? <p className="text-fg-muted">None.</p> : <ul className="space-y-1">{l.tasks.map((t) => <li key={t.id} className={t.done_at ? "text-fg-muted line-through" : ""}>{t.title}{t.due_at ? ` · ${t.due_at.slice(0, 10)}` : ""}</li>)}</ul>}
          </section>
        </div>
      </div>
    </>
  );
}
