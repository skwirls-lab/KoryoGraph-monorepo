"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Button } from "@koryo/ui/components/ui/button";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { PRICE_PER, priceFor, type PriceOption } from "@/lib/validation/events";
import { registerForEvent } from "@/server/actions/events";

export interface RegisterPerson { id: string; name: string; allergies: string[]; missingWaivers: { id: string; name: string }[] }
export interface RegisterDay { id: string; label: string; left: number | null }

/** Choose the student, a price option and (for camps) days; required waivers and allergies are checked first. */
export function RegisterForm({ eventId, people, options, days, surface, currency }: {
  eventId: string;
  people: RegisterPerson[];
  options: PriceOption[];
  days: RegisterDay[];
  surface: "desk" | "home";
  currency: string;
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [option, setOption] = useState(options[0]?.label ?? "");
  const [chosen, setChosen] = useState<string[]>(days.filter((d) => d.left !== 0).map((d) => d.id));
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ invoiceId: string | null; priceCents: number } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const person = people.find((p) => p.id === personId);
  const opt = options.find((o) => o.label === option);
  const total = opt ? priceFor(opt, days.length ? chosen.length : 0) : 0;

  if (!people.length) return <p className="text-sm text-fg-muted">{surface === "home" ? "Everyone in your family is already registered." : "No students to register."}</p>;
  if (done) {
    return (
      <div role="status" className="space-y-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        <p className="font-medium">Registered{done.priceCents ? ` — ${formatMoney(done.priceCents, currency)} due` : ""}.</p>
        {done.invoiceId ? (surface === "home"
          ? <p>Pay on <Link href={`/home/billing?invoice=${done.invoiceId}`}>Billing</Link> (or at the front desk) to confirm the spot.</p>
          : <p><Link href={`/desk/billing/invoices/${done.invoiceId}`}>Open the invoice</Link> to take payment.</p>) : null}
        <Button size="sm" variant="outline" onClick={() => { setDone(null); setAck(false); }}>Register someone else</Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await registerForEvent({ eventId, personId, option, dayIds: days.length ? chosen : [], allergiesAck: ack });
        if (!r.ok) { setError(r.error); return; }
        toast.success(`${person?.name ?? "Student"} is registered`);
        setDone(r.data);
        router.refresh();
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="reg-person">Student</Label>
          <select id="reg-person" className={selectClass} value={personId} onChange={(e) => { setPersonId(e.target.value); setAck(false); }}>
            {people.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
          </select>
        </div>
        {options.length ? (
          <div className="space-y-1">
            <Label htmlFor="reg-option">Option</Label>
            <select id="reg-option" className={selectClass} value={option} onChange={(e) => setOption(e.target.value)}>
              {options.map((o) => <option key={o.label} value={o.label} className="bg-surface">{o.label} — {formatMoney(o.price_cents, currency)} {PRICE_PER[o.per]}</option>)}
            </select>
          </div>
        ) : null}
      </div>
      {days.length ? (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Days</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {days.map((d) => (
              <label key={d.id} className={`flex items-center gap-2 text-sm ${d.left === 0 ? "text-fg-muted" : ""}`}>
                <input type="checkbox" className="accent-[var(--color-primary)]" disabled={d.left === 0} checked={chosen.includes(d.id)}
                  onChange={(e) => setChosen(e.target.checked ? [...chosen, d.id] : chosen.filter((x) => x !== d.id))} />
                {d.label}{d.left === 0 ? " — full" : d.left !== null ? ` — ${d.left} left` : ""}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {person?.missingWaivers.length ? (
        <div role="note" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">Sign first: {person.missingWaivers.map((w) => w.name).join(", ")}</p>
          {surface === "home"
            ? person.missingWaivers.map((w) => <Link key={w.id} className="mr-3" href={`/home/documents/sign?template=${w.id}&person=${person.id}`}>Sign {w.name}</Link>)
            : <Link href={`/desk/people/${person.id}?tab=documents`}>Open {person.name}&apos;s documents</Link>}
        </div>
      ) : null}
      {person?.allergies.length ? (
        <label className="flex items-start gap-2 rounded-lg border border-default p-3 text-sm">
          <input type="checkbox" className="mt-0.5 accent-[var(--color-primary)]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>Allergies on file for {person.name}: <strong>{person.allergies.join(", ")}</strong>. I confirm this is current and staff should be aware.</span>
        </label>
      ) : null}
      <p className="text-sm" aria-live="polite">Total: <strong>{formatMoney(total, currency)}</strong>{days.length ? ` for ${chosen.length} day${chosen.length === 1 ? "" : "s"}` : ""}</p>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending || Boolean(person?.missingWaivers.length) || (days.length > 0 && !chosen.length)}>{pending ? "Registering…" : "Register"}</Button>
    </form>
  );
}
