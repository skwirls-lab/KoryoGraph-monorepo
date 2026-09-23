import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { CancelRegistrationButton, DepositButton, EventStatusButtons, GuestLinkPanel } from "@/components/events/event-controls";
import { EventWizard } from "@/components/events/event-wizard";
import { RegisterForm } from "@/components/events/register-form";
import { displayName } from "@/lib/people";
import { EVENT_KINDS, PRICE_PER, parsePricing, type EventKind } from "@/lib/validation/events";
import { requireSurfacePage } from "@/server/context";
import { eventDays, pickupNames, registerablePeople } from "@/server/queries/events";

export const metadata = { title: "Event" };

const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";
const local = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).split(", ");

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("events.manage")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: ev } = await ctx.supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!ev) notFound();
  const [days, { data: regs }, people, { data: waivers }, { data: households }, { data: checkins }, { data: guests }] = await Promise.all([
    eventDays(ctx, ev),
    ctx.supabase.from("event_registrations").select("id, person_id, option_label, days, status, invoice_id, allergies_ack, notes, people(first_name, last_name, preferred_name, allergies), invoices(status, balance_cents, total_cents)")
      .eq("event_id", id).order("created_at"),
    registerablePeople(ctx, ev, "desk"),
    ctx.supabase.from("document_templates").select("id, name").eq("kind", "waiver").eq("active", true).order("name"),
    ctx.supabase.from("households").select("id, name").order("name").limit(1000),
    ctx.supabase.from("event_checkins").select("event_day_id, person_id, out_at"),
    ev.kind === "party" ? ctx.supabase.from("event_guest_waivers").select("id, guest_name, guardian_name, signed_at").eq("event_id", id).order("signed_at") : Promise.resolve({ data: [] }),
  ]);
  const active = (regs ?? []).filter((r) => r.status !== "cancelled");
  const pickups = await pickupNames(ctx, active.map((r) => r.person_id));
  const { data: deposit } = ev.deposit_invoice_id ? await ctx.supabase.from("invoices").select("id, status, balance_cents").eq("id", ev.deposit_invoice_id).maybeSingle() : { data: null };
  const host = (households ?? []).find((h) => h.id === ev.host_household_id);
  const options = parsePricing(ev.pricing);
  const s = local(ev.starts_at, ctx.tz);
  const e = local(ev.ends_at, ctx.tz);
  const dayIds = new Set(days.map((d) => d.id));
  const byDay = (dayId: string) => (checkins ?? []).filter((c) => c.event_day_id === dayId && dayIds.has(dayId));
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/events">Events</Link>} title={ev.name}
        description={<span className="inline-flex flex-wrap items-center gap-2"><Badge variant="outline">{EVENT_KINDS[ev.kind as EventKind] ?? ev.kind}</Badge><Badge variant={ev.status === "open" ? "secondary" : "outline"}>{ev.status}</Badge>
          {new Date(ev.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "medium", timeStyle: "short" })}{days.length > 1 ? ` · ${days.length} days` : ""}{ev.capacity ? ` · capacity ${ev.capacity}${days.length > 1 ? " per day" : ""}` : ""}</span>}
        actions={<div className="flex flex-wrap gap-2"><EventStatusButtons eventId={ev.id} status={ev.status as "open"} /></div>} />
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <section className={card} aria-labelledby="roster-h">
            <h2 id="roster-h" className="mb-3 text-base font-semibold">Roster ({active.length})</h2>
            {!regs?.length ? <p className="text-sm text-fg-muted">No one registered yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-fg-muted"><tr><th className="py-1 pr-2">Student</th><th className="pr-2">Option</th><th className="pr-2">Days</th><th className="pr-2">Status</th><th className="pr-2">Pickup</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody className="divide-y divide-default">
                    {regs.map((r) => {
                      const name = r.people ? displayName(r.people) : "Student";
                      const allergies = r.people?.allergies ?? [];
                      return (
                        <tr key={r.id} aria-label={name} className={r.status === "cancelled" ? "text-fg-muted" : ""}>
                          <td className="py-2 pr-2">
                            <Link href={`/desk/people/${r.person_id}`} className="font-medium">{name}</Link>
                            {allergies.length ? <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-danger"><AlertTriangle aria-hidden className="size-3" />{allergies.join(", ")}</span> : null}
                          </td>
                          <td className="pr-2">{r.option_label}</td>
                          <td className="pr-2">{r.days && days.length > 1 ? `${r.days.length}/${days.length}` : "—"}</td>
                          <td className="pr-2">
                            <Badge variant={["paid", "attended"].includes(r.status) ? "secondary" : r.status === "cancelled" ? "outline" : "outline"}>{r.status}</Badge>
                            {r.invoice_id && r.status === "registered" ? <Link href={`/desk/billing/invoices/${r.invoice_id}`} className="ml-1 text-xs">{formatMoney(r.invoices?.balance_cents ?? 0, ctx.currency)} due</Link> : null}
                          </td>
                          <td className="pr-2 text-xs text-fg-secondary">{r.status !== "cancelled" ? (pickups.get(r.person_id)?.join(", ") || <span className="text-warning">none on file</span>) : null}</td>
                          <td className="text-right">{r.status !== "cancelled" ? <CancelRegistrationButton id={r.id} name={name} /> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className={card} aria-labelledby="days-h">
            <h2 id="days-h" className="mb-3 text-base font-semibold">Check-in</h2>
            <ul className="divide-y divide-default text-sm" aria-label="Days">
              {days.map((d) => {
                const c = byDay(d.id);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-medium">{d.label}</span>
                    <span className="text-xs text-fg-muted">{d.taken} registered · {c.filter((x) => !x.out_at).length} here · {c.filter((x) => x.out_at).length} picked up</span>
                    <Button asChild size="sm" variant="outline" className="ml-auto"><Link href={`/desk/events/${ev.id}/checkin?day=${d.id}`}>Open check-in</Link></Button>
                  </li>
                );
              })}
            </ul>
          </section>
          {ev.kind === "party" ? (
            <section className={card} aria-labelledby="party-h">
              <h2 id="party-h" className="mb-3 text-base font-semibold">Party</h2>
              <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-fg-muted">Host</dt><dd>{host ? host.name : "Not set"}</dd>
                <dt className="text-fg-muted">Deposit</dt>
                <dd>{ev.deposit_cents ? formatMoney(ev.deposit_cents, ctx.currency) : "None"}{deposit ? <> · <Link href={`/desk/billing/invoices/${deposit.id}`}>{deposit.status === "paid" ? "paid" : `${formatMoney(deposit.balance_cents, ctx.currency)} due`}</Link></> : null}</dd>
              </dl>
              {!deposit && ev.deposit_cents && host && ctx.modules.has("billing") ? <div className="mb-3"><DepositButton eventId={ev.id} /></div> : null}
              <h3 className="mb-2 text-sm font-semibold">Guest waivers ({guests?.length ?? 0})</h3>
              <GuestLinkPanel eventId={ev.id} hasLink={Boolean(ev.guest_link_token_hash)} origin={origin} />
              {guests?.length ? (
                <ul className="mt-3 divide-y divide-default text-sm" aria-label="Signed guest waivers">
                  {guests.map((g) => <li key={g.id} className="py-1.5">{g.guest_name} <span className="text-xs text-fg-muted">signed by {g.guardian_name} · {new Date(g.signed_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "short", timeStyle: "short" })}</span></li>)}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
        <div className="space-y-4">
          <section className={card} aria-labelledby="reg-h">
            <h2 id="reg-h" className="mb-3 text-base font-semibold">Register a student</h2>
            {ev.status !== "open" ? <p className="text-sm text-fg-muted">Registration is {ev.status}.</p>
              : <RegisterForm eventId={ev.id} people={people} options={options} days={days.length > 1 ? days : []} surface="desk" currency={ctx.currency} />}
          </section>
          <section className={card} aria-labelledby="price-h">
            <h2 id="price-h" className="mb-2 text-base font-semibold">Pricing</h2>
            <ul className="text-sm">{options.length ? options.map((o) => <li key={o.label}>{o.label}: {formatMoney(o.price_cents, ctx.currency)} {PRICE_PER[o.per]}</li>) : <li className="text-fg-muted">Free</li>}</ul>
            {ev.description ? <p className="mt-3 whitespace-pre-line text-sm text-fg-secondary">{ev.description}</p> : null}
          </section>
          <details className={card}>
            <summary className="cursor-pointer text-base font-semibold">Edit event</summary>
            <div className="mt-4">
              <EventWizard waivers={waivers ?? []} households={households ?? []} initial={{
                id: ev.id, kind: ev.kind as EventKind, name: ev.name, description: ev.description, startDate: s[0] ?? "", endDate: e[0] ?? "", startTime: (s[1] ?? "09:00").slice(0, 5), endTime: (e[1] ?? "15:00").slice(0, 5),
                weekdaysOnly: days.every((d) => ![0, 6].includes(new Date(`${d.date}T12:00:00Z`).getUTCDay())),
                pricing: options.map((o) => ({ label: o.label, price: (o.price_cents / 100).toFixed(2), per: o.per })), capacity: ev.capacity ?? "", waiverIds: ev.waiver_template_ids,
                closesDate: ev.registration_closes_at ? (local(ev.registration_closes_at, ctx.tz)[0] ?? "") : "", hostHouseholdId: ev.host_household_id ?? "", deposit: ev.deposit_cents ? (ev.deposit_cents / 100).toFixed(2) : "",
              }} />
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
