"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import type { ActionResult } from "@/lib/action-result";
import { CERT_KINDS, type CertInput, type ProfileInput, type ShiftInput, type TimeEntryInput } from "@/lib/validation/staff";
import { addCertification, addShift, addTimeEntry, approveTimeEntry, closeTimeEntry, deleteCertification, deleteShift, saveStaffProfile, setStaffPin } from "@/server/actions/staff";

/** Small shared form state: values, field errors, a pending flag and a submit that refreshes on success. */
function useForm<T extends object>(initial: T, action: (v: T) => Promise<ActionResult<unknown>>, done: string, reset?: boolean) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await action(v);
      if (!r.ok) { setError(r.error); setErrors(r.fieldErrors ?? {}); return; }
      setErrors({});
      toast.success(done);
      if (reset) setV(initial);
      router.refresh();
    });
  };
  const set = (patch: Partial<T>) => setV((x) => ({ ...x, ...patch }));
  return { v, set, errors, error, pending, submit };
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label>{children}{error ? <p className="text-xs text-danger">{error}</p> : null}</div>;
}

export function ProfileForm({ initial, programs }: { initial: ProfileInput; programs: { id: string; name: string }[] }) {
  const f = useForm(initial, saveStaffProfile, "Profile saved");
  const chosen = f.v.programs ?? [];
  return (
    <form className="space-y-3" onSubmit={f.submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="sp-title" label="Title"><Input id="sp-title" value={f.v.title ?? ""} onChange={(e) => f.set({ title: e.target.value })} placeholder="Head instructor" /></Field>
        <Field id="sp-hire" label="Hire date"><Input id="sp-hire" type="date" value={f.v.hireDate ?? ""} onChange={(e) => f.set({ hireDate: e.target.value })} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="sp-hourly" label="Hourly rate" error={f.errors.hourly}><Input id="sp-hourly" inputMode="decimal" placeholder="0.00" value={f.v.hourly ?? ""} onChange={(e) => f.set({ hourly: e.target.value })} /></Field>
        <Field id="sp-class" label="Per class" error={f.errors.perClass}><Input id="sp-class" inputMode="decimal" placeholder="0.00" value={f.v.perClass ?? ""} onChange={(e) => f.set({ perClass: e.target.value })} /></Field>
        <Field id="sp-comm" label="Commission %" error={f.errors.commissionPct}><Input id="sp-comm" inputMode="decimal" placeholder="0" value={f.v.commissionPct ?? ""} onChange={(e) => f.set({ commissionPct: e.target.value })} /></Field>
      </div>
      {programs.length ? (
        <fieldset>
          <legend className="text-sm font-medium">Teaches</legend>
          <div className="flex flex-wrap gap-3">
            {programs.map((p) => (
              <label key={p.id} className="flex items-center gap-1 text-sm">
                <input type="checkbox" className="accent-[var(--color-primary)]" checked={chosen.includes(p.id)} onChange={(e) => f.set({ programs: e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id) })} />{p.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Field id="sp-bio" label="Bio"><textarea id="sp-bio" className={`${selectClass} h-20 py-2`} value={f.v.bio ?? ""} onChange={(e) => f.set({ bio: e.target.value })} /></Field>
      {f.error ? <p role="alert" className="text-sm text-danger">{f.error}</p> : null}
      <Button type="submit" disabled={f.pending}>Save profile</Button>
    </form>
  );
}

export function CertForm({ userId }: { userId: string }) {
  const f = useForm<CertInput>({ userId, kind: "cpr", name: "", issuer: "", number: "", issuedAt: "", expiresAt: "" }, addCertification, "Certification added", true);
  return (
    <form className="space-y-3" onSubmit={f.submit} aria-label="Add certification">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="c-kind" label="Kind">
          <select id="c-kind" className={selectClass} value={f.v.kind} onChange={(e) => f.set({ kind: e.target.value as CertInput["kind"] })}>
            {Object.entries(CERT_KINDS).map(([k, l]) => <option key={k} value={k} className="bg-surface">{l}</option>)}
          </select>
        </Field>
        <Field id="c-name" label="Name (optional)"><Input id="c-name" value={f.v.name ?? ""} onChange={(e) => f.set({ name: e.target.value })} placeholder="4th Dan, Kukkiwon" /></Field>
        <Field id="c-issuer" label="Issuer"><Input id="c-issuer" value={f.v.issuer ?? ""} onChange={(e) => f.set({ issuer: e.target.value })} /></Field>
        <Field id="c-number" label="Number"><Input id="c-number" value={f.v.number ?? ""} onChange={(e) => f.set({ number: e.target.value })} /></Field>
        <Field id="c-issued" label="Issued"><Input id="c-issued" type="date" value={f.v.issuedAt ?? ""} onChange={(e) => f.set({ issuedAt: e.target.value })} /></Field>
        <Field id="c-expires" label="Expires" error={f.errors.expiresAt}><Input id="c-expires" type="date" value={f.v.expiresAt ?? ""} onChange={(e) => f.set({ expiresAt: e.target.value })} /></Field>
      </div>
      {f.error ? <p role="alert" className="text-sm text-danger">{f.error}</p> : null}
      <Button type="submit" size="sm" disabled={f.pending}>Add certification</Button>
    </form>
  );
}

function RowButton({ label, run, done, variant = "ghost", children }: { label: string; run: () => Promise<ActionResult<unknown>>; done: string; variant?: "ghost" | "outline"; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button size="sm" variant={variant} disabled={pending} aria-label={label}
      onClick={() => start(async () => { const r = await run(); if (r.ok) toast.success(done); else toast.error(r.error); router.refresh(); })}>{children}</Button>
  );
}

export const DeleteCertButton = ({ id, name }: { id: string; name: string }) => <RowButton label={`Remove ${name}`} run={() => deleteCertification({ id })} done="Removed"><Trash2 className="size-4" /></RowButton>;
export const ApproveEntryButton = ({ id }: { id: string }) => <RowButton label="Approve time entry" run={() => approveTimeEntry({ id })} done="Approved" variant="outline">Approve</RowButton>;
export const CloseEntryButton = ({ id, name }: { id: string; name: string }) => <RowButton label={`Clock ${name} out`} run={() => closeTimeEntry({ id })} done="Clocked out" variant="outline">Clock out</RowButton>;
export const DeleteShiftButton = ({ id, label }: { id: string; label: string }) => <RowButton label={`Remove shift ${label}`} run={() => deleteShift({ id })} done="Shift removed"><Trash2 className="size-4" /></RowButton>;

export function PinForm({ userId, hasPin }: { userId: string; hasPin: boolean }) {
  const f = useForm({ userId, pin: "" }, setStaffPin, "Kiosk PIN set", true);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={f.submit}>
      <Field id="pin" label={hasPin ? "New kiosk PIN" : "Kiosk PIN"}><Input id="pin" className="w-32" inputMode="numeric" autoComplete="off" maxLength={4} value={f.v.pin} onChange={(e) => f.set({ pin: e.target.value.replace(/\D/g, "") })} /></Field>
      <Button type="submit" size="sm" disabled={f.pending || f.v.pin.length !== 4}>{hasPin ? "Change PIN" : "Set PIN"}</Button>
      {f.error ? <p role="alert" className="w-full text-sm text-danger">{f.error}</p> : null}
    </form>
  );
}

export function TimeEntryForm({ userId, today }: { userId: string; today: string }) {
  const f = useForm<TimeEntryInput>({ userId, date: today, clockIn: "09:00", clockOut: "17:00", notes: "" }, addTimeEntry, "Time entry added");
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={f.submit} aria-label="Add time entry">
      <Field id="te-date" label="Date"><Input id="te-date" type="date" value={f.v.date} onChange={(e) => f.set({ date: e.target.value })} /></Field>
      <Field id="te-in" label="In"><Input id="te-in" type="time" value={f.v.clockIn} onChange={(e) => f.set({ clockIn: e.target.value })} /></Field>
      <Field id="te-out" label="Out" error={f.errors.clockOut}><Input id="te-out" type="time" value={f.v.clockOut} onChange={(e) => f.set({ clockOut: e.target.value })} /></Field>
      <Field id="te-notes" label="Note"><Input id="te-notes" value={f.v.notes ?? ""} onChange={(e) => f.set({ notes: e.target.value })} placeholder="Forgot to clock in" /></Field>
      <Button type="submit" size="sm" disabled={f.pending}>Add entry</Button>
      {f.error ? <p role="alert" className="w-full text-sm text-danger">{f.error}</p> : null}
    </form>
  );
}

export function ShiftForm({ staff, today }: { staff: { id: string; name: string }[]; today: string }) {
  const f = useForm<ShiftInput>({ userId: staff[0]?.id ?? "", date: today, start: "15:00", end: "20:00", roleLabel: "" }, addShift, "Shift added");
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={f.submit} aria-label="Add shift">
      <Field id="sh-user" label="Staff">
        <select id="sh-user" className={`${selectClass} w-48`} value={f.v.userId} onChange={(e) => f.set({ userId: e.target.value })}>
          {staff.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.name}</option>)}
        </select>
      </Field>
      <Field id="sh-date" label="Date"><Input id="sh-date" type="date" value={f.v.date} onChange={(e) => f.set({ date: e.target.value })} /></Field>
      <Field id="sh-start" label="Start"><Input id="sh-start" type="time" value={f.v.start} onChange={(e) => f.set({ start: e.target.value })} /></Field>
      <Field id="sh-end" label="End" error={f.errors.end}><Input id="sh-end" type="time" value={f.v.end} onChange={(e) => f.set({ end: e.target.value })} /></Field>
      <Field id="sh-role" label="Role"><Input id="sh-role" className="w-36" value={f.v.roleLabel ?? ""} onChange={(e) => f.set({ roleLabel: e.target.value })} placeholder="Front desk" /></Field>
      <Button type="submit" size="sm" disabled={f.pending}>Add shift</Button>
      {f.error ? <p role="alert" className="w-full text-sm text-danger">{f.error}</p> : null}
    </form>
  );
}
