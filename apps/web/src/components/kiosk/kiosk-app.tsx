"use client";

import { ArrowLeft, CheckCircle2, Search } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { KioskKeypad } from "@koryo/ui/components/app/kiosk-keypad";
import { initials } from "@koryo/ui/components/app/person-chip";
import { Button } from "@koryo/ui/components/ui/button";
import { cn } from "@koryo/ui/lib/utils";
import { kioskCheckIn, kioskFamily, kioskSearch, kioskSessions, kioskUnlock, kioskUnsigned, type KioskFamily, type KioskSession } from "@/server/kiosk/actions";

type Step =
  | { kind: "search" }
  | { kind: "family"; family: KioskFamily; selected: string[] }
  | { kind: "pin"; family: KioskFamily; selected: string[]; message?: string }
  | { kind: "sessions"; family: KioskFamily; pin: string | null; sessions: KioskSession[]; chosen: Record<string, string>; unsigned: { personId: string; templateName: string }[] }
  | { kind: "done"; names: string[] }
  | { kind: "error"; message: string };

function timeOf(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

export function KioskApp({ info }: { info: { tenantName: string; locationName: string; confirmMode: "pin" | "photo"; timeZone: string } }) {
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ personId: string; name: string; household: string | null }[]>([]);
  const [pending, start] = useTransition();
  const debounce = useRef<number | undefined>(undefined);

  // Auto-reset after success (3 s) and after inactivity (60 s) so the next family starts clean.
  useEffect(() => {
    if (step.kind === "search") return;
    const t = window.setTimeout(() => { setStep({ kind: "search" }); setQ(""); setResults([]); }, step.kind === "done" ? 3000 : 60_000);
    return () => window.clearTimeout(t);
  }, [step]);

  const reset = () => { setStep({ kind: "search" }); setQ(""); setResults([]); };

  const loadSessions = (family: KioskFamily, selected: string[], pin: string | null) =>
    start(async () => {
      const [r, u] = await Promise.all([kioskSessions(selected), kioskUnsigned(selected)]);
      if (!r.ok) return setStep({ kind: "error", message: r.error });
      const chosen: Record<string, string> = {};
      for (const pid of selected) {
        const s = r.data.find((x) => x.personId === pid && x.suggested && !x.alreadyIn) ?? r.data.find((x) => x.personId === pid && !x.alreadyIn);
        if (s) chosen[pid] = s.sessionId;
      }
      setStep({ kind: "sessions", family, pin, sessions: r.data, chosen, unsigned: u.ok ? u.data : [] });
    });

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-6 text-lg">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-display text-2xl font-bold">{info.tenantName}</p>
          <p className="text-sm text-fg-secondary">{info.locationName} · Check-in</p>
        </div>
        {step.kind !== "search" ? <Button variant="outline" size="lg" className="gap-2" onClick={reset}><ArrowLeft aria-hidden className="size-5" /> Start over</Button> : null}
      </header>

      {step.kind === "search" ? (
        <section className="space-y-4" aria-label="Find your name">
          <h1 className="text-3xl font-bold">Welcome! Type your first or last name.</h1>
          <label className="relative block">
            <span className="sr-only">Name</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-fg-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                const v = e.target.value;
                setQ(v);
                window.clearTimeout(debounce.current);
                debounce.current = window.setTimeout(() => start(async () => { const r = await kioskSearch(v); setResults(r.ok ? r.data : []); }), 200);
              }}
              className="h-16 w-full rounded-2xl border border-strong bg-surface pl-14 pr-4 text-2xl text-fg outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
              placeholder="Start typing…"
              autoComplete="off"
            />
          </label>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Matching students" aria-busy={pending}>
            {results.map((r) => (
              <li key={r.personId}>
                <button type="button" className="flex min-h-20 w-full items-center gap-4 rounded-2xl border border-default bg-surface px-4 text-left hover:border-strong"
                  onClick={() => start(async () => {
                    const f = await kioskFamily(r.personId);
                    if (!f.ok) return setStep({ kind: "error", message: f.error });
                    setStep({ kind: "family", family: f.data, selected: [r.personId] });
                  })}>
                  <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-brand-subtle font-semibold text-brand-text">{initials(r.name)}</span>
                  <span><span className="block text-xl font-semibold">{r.name}</span>{r.household ? <span className="text-sm text-fg-muted">{r.household}</span> : null}</span>
                </button>
              </li>
            ))}
          </ul>
          {q.trim().length >= 2 && !pending && results.length === 0 ? <p className="text-fg-secondary">No match. Please see the front desk.</p> : null}
        </section>
      ) : null}

      {step.kind === "family" ? (
        <section className="space-y-4" aria-label="Who is checking in">
          <h1 className="text-3xl font-bold">Who&apos;s checking in?</h1>
          <p className="text-fg-secondary">{step.family.householdName}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {step.family.members.map((m) => {
              const on = step.selected.includes(m.personId);
              return (
                <li key={m.personId}>
                  <button type="button" aria-pressed={on} onClick={() => setStep({ ...step, selected: on ? step.selected.filter((x) => x !== m.personId) : [...step.selected, m.personId] })}
                    className={cn("flex min-h-20 w-full items-center gap-3 rounded-2xl border px-4 text-left text-xl", on ? "border-success bg-success/10" : "border-default bg-surface")}>
                    <CheckCircle2 aria-hidden className={cn("size-7", on ? "text-success" : "text-fg-muted")} />
                    {m.name}
                  </button>
                </li>
              );
            })}
          </ul>
          <Button size="lg" className="h-14 w-full text-lg" disabled={step.selected.length === 0 || pending}
            onClick={() => {
              if (info.confirmMode === "photo") return loadSessions(step.family, step.selected, null);
              if (!step.family.hasPin) return setStep({ kind: "error", message: "Your family doesn't have a check-in PIN yet. Please see the front desk." });
              setStep({ kind: "pin", family: step.family, selected: step.selected });
            }}>
            Continue
          </Button>
        </section>
      ) : null}

      {step.kind === "pin" ? (
        <section className="space-y-6 text-center" aria-label="Enter your family PIN">
          <h1 className="text-3xl font-bold">Enter your family PIN</h1>
          {step.message ? <p role="alert" className="text-danger">{step.message}</p> : null}
          <KioskKeypad label="Family PIN" disabled={pending} onComplete={(pin) => start(async () => {
            const r = await kioskUnlock(step.family.householdId, pin);
            if (!r.ok) return setStep({ kind: "error", message: r.error });
            if (r.data.lockedUntil) return setStep({ ...step, message: `Too many attempts. Try again after ${timeOf(r.data.lockedUntil, info.timeZone)} or see the front desk.` });
            if (!r.data.ok) return setStep({ ...step, message: `That PIN didn't match. ${r.data.attemptsLeft} ${r.data.attemptsLeft === 1 ? "try" : "tries"} left.` });
            loadSessions(step.family, step.selected, pin);
          })} />
        </section>
      ) : null}

      {step.kind === "sessions" ? (
        <section className="space-y-4" aria-label="Pick classes">
          <h1 className="text-3xl font-bold">Today&apos;s classes</h1>
          {step.unsigned.length ? (
            <div role="alert" className="rounded-2xl border border-warning/60 bg-warning/10 p-4 text-base">
              <p className="font-semibold">Please sign before your next class:</p>
              <ul className="list-disc pl-5">
                {step.unsigned.map((u) => <li key={`${u.personId}-${u.templateName}`}>{u.templateName} for {step.family.members.find((m) => m.personId === u.personId)?.name ?? "your student"}</li>)}
              </ul>
              <p className="text-sm text-fg-secondary">Sign now in the Home app under Forms, or ask the front desk to email you a signing link.</p>
            </div>
          ) : null}
          {step.family.members.filter((m) => step.sessions.some((s) => s.personId === m.personId)).length === 0 ? (
            <p className="text-fg-secondary">There are no classes to check into right now. Please see the front desk.</p>
          ) : null}
          {step.family.members.map((m) => {
            const options = step.sessions.filter((s) => s.personId === m.personId);
            if (options.length === 0) return null;
            return (
              <fieldset key={m.personId} className="space-y-2">
                <legend className="text-xl font-semibold">{m.name}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.map((s) => {
                    const on = step.chosen[m.personId] === s.sessionId;
                    return (
                      <button key={s.sessionId} type="button" disabled={s.alreadyIn} aria-pressed={on}
                        onClick={() => setStep({ ...step, chosen: { ...step.chosen, [m.personId]: on ? "" : s.sessionId } })}
                        className={cn("min-h-16 rounded-2xl border px-4 text-left", on ? "border-success bg-success/10" : "border-default bg-surface", s.alreadyIn && "opacity-60")}>
                        <span className="block font-semibold">{s.name}</span>
                        <span className="text-sm text-fg-secondary">{timeOf(s.startsAt, info.timeZone)}{s.alreadyIn ? " · already checked in" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          <Button size="lg" className="h-14 w-full text-lg" disabled={pending || !Object.values(step.chosen).some(Boolean)}
            onClick={() => start(async () => {
              const items = Object.entries(step.chosen).filter(([, sid]) => sid).map(([person_id, session_id]) => ({ person_id, session_id }));
              const r = await kioskCheckIn({ householdId: step.family.householdId, pin: step.pin, items });
              if (!r.ok) return setStep({ kind: "error", message: r.error });
              setStep({ kind: "done", names: step.family.members.filter((m) => step.chosen[m.personId]).map((m) => m.name) });
            })}>
            Check in
          </Button>
        </section>
      ) : null}

      {step.kind === "done" ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center" role="status" aria-label="Checked in">
          <CheckCircle2 aria-hidden className="size-24 text-success" />
          <h1 className="text-4xl font-bold">You&apos;re checked in!</h1>
          <p className="text-xl text-fg-secondary">{step.names.join(" & ")} — have a great class.</p>
        </section>
      ) : null}

      {step.kind === "error" ? (
        <section className="space-y-4" role="alert">
          <h1 className="text-2xl font-bold">Something needs a hand</h1>
          <p>{step.message}</p>
          <Button size="lg" onClick={reset}>Start over</Button>
        </section>
      ) : null}
    </main>
  );
}
