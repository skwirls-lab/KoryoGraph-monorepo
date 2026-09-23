"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { WEEKDAYS } from "@/lib/validation/afterschool";
import { endAfterschool, enrollAfterschool } from "@/server/actions/afterschool";

export function EnrollForm({ programId, people, schools, routes, days, today }: {
  programId: string;
  people: { id: string; name: string }[];
  schools: string[];
  routes: string[];
  days: number[];
  today: string;
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [school, setSchool] = useState(schools[0] ?? "");
  const [route, setRoute] = useState(routes[0] ?? "");
  const [chosen, setChosen] = useState<number[]>(days);
  const [startsOn, setStartsOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!people.length) return <p className="text-sm text-fg-muted">Every active student is already enrolled.</p>;
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await enrollAfterschool({ programId, personId, school, route, days: chosen, startsOn });
        if (!r.ok) { setError(r.error); return; }
        toast.success(`${people.find((p) => p.id === personId)?.name ?? "Child"} enrolled`);
        router.refresh();
      });
    }}>
      <div className="space-y-1"><Label htmlFor="en-person">Child</Label>
        <select id="en-person" className={selectClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
          {people.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="en-school">School</Label>
          <select id="en-school" className={selectClass} value={school} onChange={(e) => setSchool(e.target.value)}>
            {schools.map((s) => <option key={s} value={s} className="bg-surface">{s}</option>)}
          </select>
        </div>
        {routes.length ? (
          <div className="space-y-1"><Label htmlFor="en-route">Route</Label>
            <select id="en-route" className={selectClass} value={route} onChange={(e) => setRoute(e.target.value)}>
              {routes.map((s) => <option key={s} value={s} className="bg-surface">{s}</option>)}
            </select>
          </div>
        ) : null}
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Days</legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.filter((d) => days.includes(d.value)).map((d) => (
            <label key={d.value} className="flex items-center gap-1 text-sm">
              <input type="checkbox" className="accent-[var(--color-primary)]" checked={chosen.includes(d.value)}
                onChange={(e) => setChosen(e.target.checked ? [...chosen, d.value].sort() : chosen.filter((x) => x !== d.value))} />{d.short}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1"><Label htmlFor="en-start">Starts</Label><Input id="en-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending || !chosen.length}>{pending ? "Enrolling…" : "Enroll"}</Button>
    </form>
  );
}

export function EndEnrollmentButton({ id, name, today }: { id: string; name: string; today: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button size="sm" variant="ghost" disabled={pending} aria-label={`End ${name}'s enrollment`}
      onClick={() => { if (!confirm(`End ${name}'s after-school enrollment today? Weekly billing stops after today.`)) return; start(async () => { const r = await endAfterschool({ enrollmentId: id, endsOn: today }); if (r.ok) toast.success("Enrollment ended"); else toast.error(r.error); router.refresh(); }); }}>End</Button>
  );
}
