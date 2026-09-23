"use client";

import { useState, useTransition } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { signGuestWaiver } from "@/server/public/guest-waiver-actions";

/** A party guest's parent signs without an account; each guest gets their own waiver. */
export function GuestWaiverForm({ token, documentName }: { token: string; documentName: string }) {
  const empty = { guestName: "", guestDob: "", guardianName: "", guardianPhone: "", typedSignature: "" };
  const [v, setV] = useState(empty);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div role="status" className="space-y-3 rounded-xl border border-success/40 bg-success/10 p-4">
        <p>Signed for {done} — thank you. See you at the party!</p>
        <Button variant="outline" onClick={() => { setDone(null); setV({ ...empty, guardianName: v.guardianName, guardianPhone: v.guardianPhone }); setAgree(false); }}>Sign for another guest</Button>
      </div>
    );
  }
  const field = (k: keyof typeof empty, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`gw-${k}`}>{label}</Label>
      <Input id={`gw-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} {...props} />
    </div>
  );
  return (
    <form className="space-y-3 rounded-xl border border-default bg-surface p-4" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await signGuestWaiver({ token, ...v, agree: agree as true });
        if (r.ok) setDone(v.guestName); else setError(r.error);
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("guestName", "Guest's name", { autoComplete: "off" })}
        {field("guestDob", "Guest's date of birth", { type: "date" })}
        {field("guardianName", "Parent or guardian", { autoComplete: "name" })}
        {field("guardianPhone", "Phone", { type: "tel", autoComplete: "tel" })}
      </div>
      {field("typedSignature", "Type your full name to sign", { autoComplete: "off" })}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 accent-[var(--color-primary)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I am the parent or legal guardian and agree to {documentName} on the guest&apos;s behalf.
      </label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Signing…" : "Sign waiver"}</Button>
    </form>
  );
}
