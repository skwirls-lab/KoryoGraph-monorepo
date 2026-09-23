import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { RegisterForm } from "@/components/events/register-form";
import { parsePricing } from "@/lib/validation/events";
import { requireSurfacePage } from "@/server/context";
import { eventDays, familyPersonIds, registerablePeople } from "@/server/queries/events";

export const metadata = { title: "Event" };

const LABEL: Record<string, string> = { registered: "Registered — payment due", paid: "Registered and paid", attended: "Attended", cancelled: "Cancelled" };

export default async function HomeEventPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("home");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !ctx.modules.has("programs_plus")) notFound();
  const { data: ev } = await ctx.supabase.from("events").select("*").eq("id", id).neq("kind", "party").maybeSingle();
  if (!ev || ev.status === "draft") notFound();
  const family = await familyPersonIds(ctx);
  const [days, people, { data: regs }] = await Promise.all([
    eventDays(ctx, ev),
    registerablePeople(ctx, ev, "home"),
    ctx.supabase.from("event_registrations").select("id, status, days, option_label, invoice_id, people(first_name, preferred_name), invoices(balance_cents)").eq("event_id", id).in("person_id", family).neq("status", "cancelled"),
  ]);
  const closed = ev.status !== "open" || (ev.registration_closes_at !== null && new Date(ev.registration_closes_at) < new Date());
  return (
    <>
      <PageHeader eyebrow={<Link href="/home/events">Events</Link>} title={ev.name}
        description={`${new Date(ev.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "full", timeStyle: "short" })}${days.length > 1 ? ` · ${days.length} days` : ""}`} />
      <div className="space-y-4">
        {ev.description ? <p className="whitespace-pre-line text-sm text-fg-secondary">{ev.description}</p> : null}
        {regs?.length ? (
          <ul className="space-y-2" aria-label="Your registrations">
            {regs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-default bg-surface p-3 text-sm">
                <span className="font-semibold">{r.people?.preferred_name || r.people?.first_name}</span>
                <span className="text-fg-secondary">{r.option_label}{r.days && days.length > 1 ? ` · ${r.days.length} day${r.days.length === 1 ? "" : "s"}` : ""}</span>
                <Badge variant={r.status === "registered" ? "outline" : "secondary"}>{LABEL[r.status] ?? r.status}</Badge>
                {r.status === "registered" && r.invoice_id && (r.invoices?.balance_cents ?? 0) > 0
                  ? <span className="w-full">Pay the {formatMoney(r.invoices?.balance_cents ?? 0, ctx.currency)} on <Link href={`/home/billing?invoice=${r.invoice_id}`}>Billing</Link> (or at the front desk).</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <section aria-labelledby="reg-h" className="rounded-xl border border-default bg-surface p-4">
          <h2 id="reg-h" className="mb-3 text-base font-semibold">Register</h2>
          {closed ? <p className="text-sm text-fg-muted">Registration is closed.</p>
            : <RegisterForm eventId={ev.id} people={people} options={parsePricing(ev.pricing)} days={days.length > 1 ? days : []} surface="home" currency={ctx.currency} />}
        </section>
      </div>
    </>
  );
}
