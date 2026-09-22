"use client";

import { useState, useTransition } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import type { ActionResult } from "@/lib/action-result";

export function SignForm({ agreement, onSign, onDone }: { agreement: string; onSign: (v: { typedName: string; agree: boolean }) => Promise<ActionResult>; onDone?: () => void }) {
  const [typedName, setTypedName] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4 rounded-xl border border-default bg-surface p-4" aria-label="Sign"
      onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await onSign({ typedName, agree }); if (r.ok) onDone?.(); else setError(r.error); }); }}>
      <div className="flex items-start gap-2">
        <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(Boolean(v))} className="mt-0.5" />
        <Label htmlFor="agree" className="font-normal leading-snug">{agreement}</Label>
      </div>
      <div className="space-y-1">
        <Label htmlFor="typed-name">Type your full name to sign</Label>
        <Input id="typed-name" value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="name" className="h-11 text-base" />
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" size="lg" disabled={pending || !agree || typedName.trim().length < 2}>{pending ? "Signing…" : "Sign"}</Button>
    </form>
  );
}
