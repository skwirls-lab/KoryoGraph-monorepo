"use client";

import { useState, useTransition } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { submitContact } from "@/server/public/contact-actions";

const TOPICS = [["general", "A question"], ["demo", "A demo for my school"], ["pricing", "Pricing"], ["support", "Help with my account"], ["privacy", "Privacy or my data"]] as const;

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", school: "", topic: "general" as (typeof TOPICS)[number][0], message: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <p role="status" className="rounded-xl border border-default bg-surface p-6">Thanks, {f.name.split(" ")[0]} — your message is with us. We reply by email, usually within one working day.</p>;
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => { const r = await submitContact({ ...f, school: f.school || undefined }); if (r.ok) setSent(true); else setError(r.error); });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="c-name">Name</Label><Input id="c-name" autoComplete="name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="c-school">School (optional)</Label><Input id="c-school" autoComplete="organization" value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="c-topic">What&apos;s it about?</Label>
          <select id="c-topic" className={`${selectClass} h-9`} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value as typeof f.topic })}>{TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
      </div>
      <div className="space-y-1"><Label htmlFor="c-message">Message</Label><textarea id="c-message" required className={`${selectClass} h-36 py-2`} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <div aria-hidden className="absolute -left-[9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label></div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
