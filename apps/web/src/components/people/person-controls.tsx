"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Switch } from "@koryo/ui/components/ui/switch";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { CONSENT_KINDS, CONSENT_LABELS, NOTE_KINDS, PERSON_STATUSES, STATUS_LABELS, type ConsentKind } from "@/lib/people";
import { addNote, changeStatus, recordConsent, removeTag, setMedicalNotes } from "@/server/actions/people";

export function StatusControl({ personId, status }: { personId: string; status: string }) {
  const [value, setValue] = useState(status);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const dirty = value !== status;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await changeStatus({ id: personId, status: value, reason });
          if (r.ok) { toast.success(`Status changed to ${STATUS_LABELS[value as keyof typeof STATUS_LABELS]}`); setReason(""); } else toast.error(r.error);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-fg-secondary">
        Status
        <select value={value} onChange={(e) => setValue(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg">
          {PERSON_STATUSES.map((s) => <option key={s} value={s} className="bg-surface">{STATUS_LABELS[s]}</option>)}
        </select>
      </label>
      {dirty ? (
        <>
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-fg-secondary">
            Reason
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
          </label>
          <Button type="submit" size="sm" disabled={pending}>Change status</Button>
        </>
      ) : null}
    </form>
  );
}

export function MedicalNotes({ personId, initial, canWrite }: { personId: string; initial: string; canWrite: boolean }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  if (!canWrite) return <p className="whitespace-pre-wrap text-sm">{initial || <span className="text-fg-muted">None recorded.</span>}</p>;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setMedicalNotes({ personId, notes: value });
          if (r.ok) toast.success("Medical notes saved"); else toast.error(r.error);
        });
      }}
    >
      <label htmlFor="medical" className="sr-only">Medical notes</label>
      <Textarea id="medical" value={value} onChange={(e) => setValue(e.target.value)} rows={3} placeholder="Conditions, medication, instructions" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending || value === initial}>Save medical notes</Button>
    </form>
  );
}

export function ConsentToggles({ personId, current, canWrite }: { personId: string; current: Partial<Record<ConsentKind, boolean>>; canWrite: boolean }) {
  const [pending, start] = useTransition();
  return (
    <ul className="space-y-2">
      {CONSENT_KINDS.map((k) => (
        <li key={k} className="flex items-center justify-between gap-3">
          <span className="text-sm">{CONSENT_LABELS[k]}</span>
          <Switch
            aria-label={CONSENT_LABELS[k]}
            checked={Boolean(current[k])}
            disabled={!canWrite || pending}
            onCheckedChange={(v) =>
              start(async () => {
                const r = await recordConsent({ personId, kind: k, granted: Boolean(v) });
                if (!r.ok) toast.error(r.error);
              })
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function TagList({ personId, tags, canWrite }: { personId: string; tags: string[]; canWrite: boolean }) {
  const [pending, start] = useTransition();
  if (tags.length === 0) return <p className="text-sm text-fg-muted">No tags.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <li key={t}>
          <Badge variant="secondary" className="gap-1">
            {t}
            {canWrite ? (
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                disabled={pending}
                className="rounded-full hover:text-danger"
                onClick={() => start(async () => { const r = await removeTag({ personId, tag: t }); if (!r.ok) toast.error(r.error); })}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function NoteForm({ personId }: { personId: string }) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<(typeof NOTE_KINDS)[number]>("general");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2 rounded-xl border border-default bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addNote({ personId, kind, body });
          if (r.ok) { setBody(""); toast.success("Note added"); } else toast.error(r.error);
        });
      }}
    >
      <label htmlFor="note-body" className="text-sm font-medium">Add a note</label>
      <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="note-kind">Kind</label>
        <select id="note-kind" value={kind} onChange={(e) => setKind(e.target.value as (typeof NOTE_KINDS)[number])} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg">
          {NOTE_KINDS.map((k) => <option key={k} value={k} className="bg-surface">{k.replace("_", " ")}</option>)}
        </select>
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>Add note</Button>
      </div>
    </form>
  );
}
