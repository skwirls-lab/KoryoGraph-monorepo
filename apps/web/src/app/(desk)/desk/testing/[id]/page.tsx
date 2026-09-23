import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { describeGap } from "@koryo/eligibility";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { EventStatusButtons, PromoteForm, RegistrationActions } from "@/components/testing/registration-controls";
import { RosterInvite, type RosterRow } from "@/components/testing/roster-invite";
import { TestDialog } from "@/components/testing/test-form";
import { requireSurfacePage } from "@/server/context";
import { staffOptions } from "@/server/queries/schedule";
import { testingRoster } from "@/server/testing/roster";

export const metadata = { title: "Belt test" };

const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";

export default async function TestingEventPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("testing.manage")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: ev } = await ctx.supabase.from("testing_events").select("*").eq("id", id).maybeSingle();
  if (!ev) notFound();
  const [roster, { data: regs }, { data: programs }, staff] = await Promise.all([
    testingRoster(ctx, ev),
    ctx.supabase.from("testing_registrations")
      .select("id, status, override_reason, result_notes, invoice_id, promotion_id, eligibility_snapshot, people(id, first_name, last_name, preferred_name), ranks!testing_registrations_tenant_id_to_rank_id_fkey(name), invoices(status, balance_cents), promotions(certificate_path)")
      .eq("testing_event_id", id).order("created_at"),
    ctx.supabase.from("programs").select("id, name").eq("active", true).order("sort"),
    staffOptions(ctx),
  ]);
  const rows: RosterRow[] = roster.filter((c) => !c.registration && c.nextRank).map((c) => ({
    enrollmentId: c.enrollmentId, name: c.name, programName: c.programName, currentRank: c.currentRank, nextRank: c.nextRank?.name ?? null,
    status: c.eligibility.status, gaps: c.eligibility.gaps.map((g) => describeGap(g, (sid) => c.skillNames.get(sid) ?? sid)),
  }));
  const person = (r: NonNullable<typeof regs>[number]) => (r.people ? `${r.people.preferred_name || r.people.first_name} ${r.people.last_name}`.trim() : "Student");
  const promotable = (regs ?? []).filter((r) => ["passed", "conditional"].includes(r.status) && !r.promotion_id).map((r) => ({ id: r.id, name: person(r), toRank: r.ranks?.name ?? null, status: r.status }));
  const certs = (regs ?? []).filter((r) => r.promotions?.certificate_path).length;
  const starts = new Date(ev.starts_at);
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(starts).split(", ");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/testing">Belt testing</Link>} title={ev.name}
        description={<span className="inline-flex flex-wrap items-center gap-2"><Badge variant={ev.status === "open" ? "secondary" : "outline"}>{ev.status}</Badge>{starts.toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "full", timeStyle: "short" })} · fee {ev.fee_cents ? formatMoney(ev.fee_cents, ctx.currency) : "none"}{ev.registration_deadline ? ` · register by ${ev.registration_deadline}` : ""}{ev.capacity ? ` · capacity ${ev.capacity}` : ""}</span>}
        actions={<div className="flex flex-wrap gap-2">
          <EventStatusButtons eventId={ev.id} status={ev.status} />
          <Button asChild size="sm" variant="outline"><Link href={`/desk/testing/${ev.id}/score`}>Scoresheets</Link></Button>
          <TestDialog programs={(programs ?? []).map((p) => ({ value: p.id, label: p.name }))} staff={staff.map((s) => ({ value: s.id, label: s.name }))}
            initial={{ id: ev.id, name: ev.name, date: local[0] ?? "", time: (local[1] ?? "10:00").slice(0, 5), durationMin: ev.ends_at ? Math.round((new Date(ev.ends_at).getTime() - starts.getTime()) / 60_000) : 120, programIds: ev.program_ids, fee: ev.fee_cents ? (ev.fee_cents / 100).toFixed(2) : "", deadline: ev.registration_deadline ?? "", capacity: ev.capacity ?? "", judgeIds: ev.judges, notes: ev.notes ?? "" }} />
        </div>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={card} aria-labelledby="roster-h">
          <h2 id="roster-h" className="mb-3 text-base font-semibold">Auto-roster</h2>
          <RosterInvite eventId={ev.id} rows={rows} open={ev.status === "open"} />
        </section>
        <div className="space-y-4">
          <section className={card} aria-labelledby="regs-h">
            <h2 id="regs-h" className="mb-3 text-base font-semibold">Registrations ({regs?.length ?? 0})</h2>
            {!regs?.length ? <p className="text-sm text-fg-muted">No one invited yet.</p> : (
              <ul className="divide-y divide-default text-sm" aria-label="Registrations">
                {regs.map((r) => (
                  <li key={r.id} aria-label={person(r)} className="flex flex-wrap items-center gap-2 py-2">
                    <Link href={`/desk/people/${r.people?.id}?tab=progress`} className="font-medium">{person(r)}</Link>
                    <span className="text-fg-secondary">→ {r.ranks?.name}</span>
                    <Badge variant={["passed", "confirmed", "paid"].includes(r.status) ? "secondary" : r.status === "failed" || r.status === "withdrawn" ? "destructive" : "outline"}>{r.promotion_id ? "promoted" : r.status}</Badge>
                    {r.invoice_id ? <Link href={`/desk/billing/invoices/${r.invoice_id}`} className="text-xs">fee: {r.invoices?.status ?? "invoice"}</Link> : null}
                    {r.override_reason ? <span className="w-full text-xs text-fg-muted">Added manually: {r.override_reason}</span> : null}
                    <span className="ml-auto"><RegistrationActions id={r.id} status={r.status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={card} aria-labelledby="promote-h">
            <h2 id="promote-h" className="mb-3 text-base font-semibold">Results &amp; promotion</h2>
            <PromoteForm eventId={ev.id} rows={promotable} />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-default pt-3">
              {certs ? <Button asChild size="sm" variant="outline"><a href={`/desk/testing/${ev.id}/certificates`} download>Certificates ZIP ({certs})</a></Button> : null}
              <Button asChild size="sm" variant="outline"><a href={`/desk/testing/${ev.id}/export?format=kukkiwon`} download>Kukkiwon CSV</a></Button>
              <Button asChild size="sm" variant="ghost"><a href={`/desk/testing/${ev.id}/export?format=generic`} download>Roster CSV</a></Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
