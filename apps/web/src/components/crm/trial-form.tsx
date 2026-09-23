"use client";

import { useState, useTransition } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { selectClass } from "@/components/forms/select-field";
import { submitTrialRequest } from "@/server/public/trial-actions";

interface Session { id: string; name: string; starts_at: string; program_ids: string[]; spots_left: number | null }

export function TrialForm({ slug, school, timezone, programs, sessions, utm }: { slug: string; school: string; timezone: string; programs: { id: string; name: string }[]; sessions: Session[]; utm: Record<string, string> }) {
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", phone: "", programId: "", sessionId: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ booked: boolean } | null>(null);
  const [pending, start] = useTransition();
  const visible = sessions.filter((s) => (!v.programId || s.program_ids.includes(v.programId)) && (s.spots_left === null || s.spots_left > 0));
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  if (done) {
    return (
      <div role="status" className="space-y-2 rounded-xl border border-default bg-surface p-6">
        <h2 className="text-xl font-semibold">Thanks, {v.firstName}!</h2>
        <p>{done.booked ? "You're booked for your trial class — we'll see you on the mat." : `${school} will be in touch shortly to set up your trial.`}</p>
      </div>
    );
  }
  return (
    <form className="space-y-4" noValidate onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await submitTrialRequest(slug, { ...v, utm });
        if (r.ok) setDone(r.data);
        else { setError(r.error); setErrors(r.fieldErrors ?? {}); }
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="t-first">First name</Label><Input id="t-first" value={v.firstName} onChange={set("firstName")} autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} />{errors.firstName ? <p className="text-xs text-danger">{errors.firstName}</p> : null}</div>
        <div className="space-y-1"><Label htmlFor="t-last">Last name</Label><Input id="t-last" value={v.lastName} onChange={set("lastName")} autoComplete="family-name" /></div>
        <div className="space-y-1"><Label htmlFor="t-email">Email</Label><Input id="t-email" type="email" value={v.email} onChange={set("email")} autoComplete="email" aria-invalid={Boolean(errors.email)} />{errors.email ? <p className="text-xs text-danger">{errors.email}</p> : null}</div>
        <div className="space-y-1"><Label htmlFor="t-phone">Phone</Label><Input id="t-phone" type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel" /></div>
      </div>
      {programs.length ? (
        <div className="space-y-1">
          <Label htmlFor="t-program">Interested in</Label>
          <select id="t-program" className={selectClass} value={v.programId} onChange={(e) => setV({ ...v, programId: e.target.value, sessionId: "" })}>
            <option value="" className="bg-surface">Not sure yet</option>
            {programs.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
          </select>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="t-session">Book a free trial class (optional)</Label>
        <select id="t-session" className={selectClass} value={v.sessionId} onChange={set("sessionId")}>
          <option value="" className="bg-surface">Contact me to schedule</option>
          {visible.map((s) => (
            <option key={s.id} value={s.id} className="bg-surface">
              {new Date(s.starts_at).toLocaleString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} — {s.name}{s.spots_left !== null ? ` (${s.spots_left} spots)` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1"><Label htmlFor="t-msg">Anything we should know?</Label><Textarea id="t-msg" value={v.message} onChange={set("message")} rows={3} /></div>
      <div aria-hidden className="absolute -left-[9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} /></label></div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Request my trial"}</Button>
    </form>
  );
}
