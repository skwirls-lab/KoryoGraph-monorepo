"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { previewSegment, sendBroadcast } from "@/server/actions/automations";

const STATUSES = ["active", "trial", "on_hold", "cancelled", "alumni"];

/** Segment builder + live count + compose + send. Only recipients with consent and an address are messaged. */
export function BroadcastForm({ programs }: { programs: { id: string; name: string }[] }) {
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>(["active"]);
  const [tags, setTags] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi {{first_name}},\n\n");
  const [count, setCount] = useState<{ people: number; recipients: number; no_consent: number; no_address: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const segment = { program_ids: programIds, statuses, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), age_min: ageMin ? Number(ageMin) : ("" as const), age_max: ageMax ? Number(ageMax) : ("" as const) };
  const key = JSON.stringify([segment, channel]);
  useEffect(() => {
    let live = true;
    previewSegment({ segment: JSON.parse(key)[0], channel: JSON.parse(key)[1] }).then((r) => { if (live && r.ok) setCount(r.data); });
    return () => { live = false; };
  }, [key]);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      if (!count?.recipients) { setError("No one in this segment can receive it."); return; }
      if (!window.confirm(`Send to ${count.recipients} recipient${count.recipients === 1 ? "" : "s"}?`)) return;
      start(async () => {
        const r = await sendBroadcast({ name, channel, subject, body, segment });
        if (!r.ok) { setError(r.error); return; }
        toast.success(`Queued ${r.data.queued} message${r.data.queued === 1 ? "" : "s"}`);
        router.push(`/desk/broadcasts/${r.data.id}`);
      });
    }}>
      <fieldset className="space-y-3 rounded-lg border border-default p-3">
        <legend className="px-1 text-sm font-semibold">Who</legend>
        <div className="flex flex-wrap gap-3 text-sm" role="group" aria-label="Programs">
          <span className="w-full text-xs text-fg-secondary">Programs (any)</span>
          {programs.map((p) => <label key={p.id} className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--color-primary)]" checked={programIds.includes(p.id)} onChange={() => toggle(programIds, setProgramIds, p.id)} />{p.name}</label>)}
        </div>
        <div className="flex flex-wrap gap-3 text-sm" role="group" aria-label="Statuses">
          <span className="w-full text-xs text-fg-secondary">Status</span>
          {STATUSES.map((s) => <label key={s} className="flex items-center gap-1 capitalize"><input type="checkbox" className="accent-[var(--color-primary)]" checked={statuses.includes(s)} onChange={() => toggle(statuses, setStatuses, s)} />{s.replace("_", " ")}</label>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label htmlFor="b-tags">Tags (any)</Label><Input id="b-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="demo-team, at-risk" /></div>
          <div className="space-y-1"><Label htmlFor="b-age-min">Min age</Label><Input id="b-age-min" type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="b-age-max">Max age</Label><Input id="b-age-max" type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} /></div>
        </div>
        <p role="status" className="text-sm">
          {count ? <><strong className="tabular">{count.recipients}</strong> recipient{count.recipients === 1 ? "" : "s"} for {count.people} student{count.people === 1 ? "" : "s"}{count.no_consent ? ` · ${count.no_consent} without ${channel === "sms" ? "SMS" : "email"} consent excluded` : ""}{count.no_address ? ` · ${count.no_address} with no ${channel === "sms" ? "phone" : "email"}` : ""}</> : "Counting…"}
        </p>
      </fieldset>
      <fieldset className="space-y-3 rounded-lg border border-default p-3">
        <legend className="px-1 text-sm font-semibold">What</legend>
        <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Channel">
          <label className="flex items-center gap-1"><input type="radio" name="channel" checked={channel === "email"} onChange={() => setChannel("email")} className="accent-[var(--color-primary)]" />Email</label>
          <label className="flex items-center gap-1"><input type="radio" name="channel" checked={channel === "sms"} onChange={() => setChannel("sms")} className="accent-[var(--color-primary)]" />Text (SMS)</label>
        </div>
        <div className="space-y-1"><Label htmlFor="b-name">Internal name</Label><Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday schedule notice" /></div>
        {channel === "email" ? <div className="space-y-1"><Label htmlFor="b-subject">Subject</Label><Input id="b-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></div> : null}
        <div className="space-y-1"><Label htmlFor="b-body">Message</Label><Textarea id="b-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-fg-muted">{"{{first_name}}"} is replaced with each recipient&apos;s first name.{channel === "sms" ? ` ${body.length}/480` : ""}</p></div>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : `Send to ${count?.recipients ?? 0}`}</Button>
    </form>
  );
}
