"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { Switch } from "@koryo/ui/components/ui/switch";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { setAttendance } from "@/server/actions/attendance";
import { bookSession } from "@/server/actions/bookings";
import { searchPeople } from "@/server/actions/people";
import { cancelSession, changeSessionInstructors, setSessionNote } from "@/server/actions/schedule";

export function CancelSessionDialog({ sessionId, name }: { sessionId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notifyRoster, setNotify] = useState(true);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive" size="sm">Cancel class</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {name}?</DialogTitle>
          <DialogDescription>Only this session is cancelled; the recurring class stays on the schedule.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
          const r = await cancelSession({ sessionId, reason, notify: notifyRoster });
          if (r.ok) {
            const n = Object.entries(r.data.notified).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(", ");
            toast.success(n ? `Cancelled. Messages: ${n}` : "Cancelled");
            setOpen(false);
          } else toast.error(r.error);
        }); }}>
          <div className="space-y-1"><Label htmlFor="cancel-reason">Reason (shared with families)</Label><Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Instructor at tournament" /></div>
          <div className="flex items-center gap-2"><Checkbox id="cancel-notify" checked={notifyRoster} onCheckedChange={(v) => setNotify(Boolean(v))} /><Label htmlFor="cancel-notify" className="font-normal">Notify booked and enrolled families</Label></div>
          <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Cancelling…" : "Cancel class"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InstructorPicker({ sessionId, staff, current }: { sessionId: string; staff: { id: string; name: string }[]; current: string[] }) {
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const dirty = value.slice().sort().join() !== current.slice().sort().join();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Instructors for this session</legend>
      <ul className="grid gap-1 sm:grid-cols-2">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <Checkbox id={`si-${s.id}`} checked={value.includes(s.id)} onCheckedChange={(c) => setValue(c ? [...value, s.id] : value.filter((x) => x !== s.id))} />
            <Label htmlFor={`si-${s.id}`} className="font-normal">{s.name}</Label>
          </li>
        ))}
      </ul>
      {dirty ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await changeSessionInstructors({ sessionId, instructorIds: value }); if (r.ok) toast.success("Instructors updated"); else toast.error(r.error); })}>
          Save instructors
        </Button>
      ) : null}
    </fieldset>
  );
}

export function SessionNote({ sessionId, initial }: { sessionId: string; initial: string }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setSessionNote({ sessionId, notes: v }); if (r.ok) toast.success("Note saved"); else toast.error(r.error); }); }}>
      <Label htmlFor="session-note">Session note</Label>
      <Textarea id="session-note" rows={2} value={v} onChange={(e) => setV(e.target.value)} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending || v === initial}>Save note</Button>
    </form>
  );
}

export function CheckInSwitch({ sessionId, personId, name, present, disabled }: { sessionId: string; personId: string; name: string; present: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(present);
  return (
    <Switch
      aria-label={`${name} present`}
      checked={on}
      disabled={disabled || pending}
      onCheckedChange={(v) => {
        setOn(Boolean(v));
        start(async () => {
          const r = await setAttendance({ sessionId, personId, present: Boolean(v), source: "desk" });
          if (!r.ok) { setOn(!v); toast.error(r.error); }
        });
      }}
    />
  );
}

export function BookPersonDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; households: string[] }[]>([]);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Book a student</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Book a student</DialogTitle><DialogDescription>Full classes put them on the waitlist.</DialogDescription></DialogHeader>
        <Input aria-label="Search students" value={q} placeholder="Search by name" onChange={(e) => { const v = e.target.value; setQ(v); start(async () => { const r = await searchPeople(v); setResults(r.ok ? r.data : []); }); }} />
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-elevated">
              <span className="text-sm">{p.name} <span className="text-fg-muted">{p.households.join(", ")}</span></span>
              <Button size="sm" disabled={pending} onClick={() => start(async () => {
                const r = await bookSession({ sessionId, personId: p.id });
                if (r.ok) { toast.success(r.data.status === "waitlisted" ? `${p.name} waitlisted (#${r.data.waitlistPosition})` : `${p.name} booked`); setOpen(false); } else toast.error(r.error);
              })}>Book</Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
