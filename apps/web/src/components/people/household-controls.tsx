"use client";

import { KeyRound, Search, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form } from "@koryo/ui/components/ui/form";
import { Input } from "@koryo/ui/components/ui/input";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { newMemberSchema } from "@/lib/validation/people";
import {
  addHouseholdMember, addNewHouseholdMember, removeHouseholdMember, searchPeople, setHouseholdPin, setPrimaryPayer, updateHousehold,
} from "@/server/actions/people";

type Rel = "guardian" | "student" | "other";
const relSelect = "h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg";

export function MemberActions({ householdId, personId, isPayer, name }: { householdId: string; personId: string; isPayer: boolean; name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1">
      {!isPayer ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await setPrimaryPayer({ householdId, personId }); if (r.ok) toast.success(`${name} is now the payer`); else toast.error(r.error); })}>
          Make payer
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => start(async () => { const r = await removeHouseholdMember({ householdId, personId }); if (r.ok) toast.success(`Removed ${name}`); else toast.error(r.error); })}>
        Remove
      </Button>
    </div>
  );
}

export function AddExistingMember({ householdId }: { householdId: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; status: string; households: string[] }[]>([]);
  const [rel, setRel] = useState<Rel>("student");
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Search aria-hidden className="size-4" /> Add existing person</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an existing person</DialogTitle>
          <DialogDescription>Someone can belong to more than one household (split families).</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Search</span>
            <Input
              value={q}
              placeholder="Search by name"
              onChange={(e) => {
                const v = e.target.value;
                setQ(v);
                start(async () => { const r = await searchPeople(v); setResults(r.ok ? r.data : []); });
              }}
            />
          </label>
          <label>
            <span className="sr-only">Relationship</span>
            <select value={rel} onChange={(e) => setRel(e.target.value as Rel)} className={relSelect}>
              <option value="student" className="bg-surface">Student</option>
              <option value="guardian" className="bg-surface">Guardian</option>
              <option value="other" className="bg-surface">Other</option>
            </select>
          </label>
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-elevated">
              <span className="min-w-0 truncate text-sm">{p.name} <span className="text-fg-muted">{p.households.join(", ")}</span></span>
              <Button size="sm" disabled={pending} onClick={() => start(async () => {
                const r = await addHouseholdMember({ householdId, personId: p.id, relationship: rel });
                if (r.ok) { toast.success(`Added ${p.name}`); setOpen(false); } else toast.error(r.error);
              })}>Add</Button>
            </li>
          ))}
          {q.length >= 2 && results.length === 0 ? <li className="px-2 text-sm text-fg-muted">No matches.</li> : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function AddNewMember({ householdId, defaultLastName }: { householdId: string; defaultLastName: string }) {
  const [open, setOpen] = useState(false);
  const { form, pending, submit } = useActionForm({
    schema: newMemberSchema,
    defaultValues: { householdId, relationship: "student", firstName: "", lastName: defaultLastName, dob: "", email: "", phone: "" },
    action: addNewHouseholdMember,
    onSuccess: () => { toast.success("Added"); setOpen(false); form.reset(); },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><UserPlus aria-hidden className="size-4" /> Add new person</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a new person to this household</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Relationship
              <select {...form.register("relationship")} className={relSelect}>
                <option value="student" className="bg-surface">Student</option>
                <option value="guardian" className="bg-surface">Guardian</option>
                <option value="other" className="bg-surface">Other</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField form={form} name="firstName" label="First name" />
              <TextField form={form} name="lastName" label="Last name" />
              <TextField form={form} name="dob" label="Date of birth" type="date" />
              <TextField form={form} name="phone" label="Phone" type="tel" />
            </div>
            <TextField form={form} name="email" label="Email" type="email" />
            <FormError form={form} />
            <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function HouseholdDetails({ id, name, billingEmail, notes }: { id: string; name: string; billingEmail: string; notes: string }) {
  const [v, setV] = useState({ name, billingEmail, notes });
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateHousehold({ id, ...v }); if (r.ok) toast.success("Household saved"); else toast.error(r.error); }); }}
    >
      <label className="block space-y-1 text-sm font-medium">Name<Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      <label className="block space-y-1 text-sm font-medium">Billing email<Input type="email" value={v.billingEmail} onChange={(e) => setV({ ...v, billingEmail: e.target.value })} /></label>
      <label className="block space-y-1 text-sm font-medium">Notes<Textarea rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></label>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>Save</Button>
    </form>
  );
}

export function PinForm({ householdId, hasPin }: { householdId: string; hasPin: boolean }) {
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setHouseholdPin({ householdId, pin }); if (r.ok) { toast.success("Kiosk PIN set"); setPin(""); } else toast.error(r.error); }); }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        <span className="inline-flex items-center gap-1"><KeyRound aria-hidden className="size-4" /> Kiosk PIN</span>
        <Input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="w-28 tracking-widest" aria-describedby="pin-help" />
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={pending || pin.length !== 4}>{hasPin ? "Change PIN" : "Set PIN"}</Button>
      <p id="pin-help" className="w-full text-xs text-fg-muted">{hasPin ? "A PIN is set. PINs are stored hashed and can't be shown." : "No PIN yet. Families use it to check in at the kiosk."}</p>
    </form>
  );
}
