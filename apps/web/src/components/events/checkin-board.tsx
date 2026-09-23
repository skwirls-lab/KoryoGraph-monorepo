"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { eventCheck } from "@/server/actions/events";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

export interface CheckinKid {
  personId: string;
  name: string;
  allergies: string[];
  pickups: string[];
  inAt: string | null;
  outAt: string | null;
  pickedUpBy: string | null;
}

/** Tablet screen for one camp day: big tap targets; check-out records who picked up and their signature. */
export function CheckinBoard({ dayId, kids }: { dayId: string; kids: CheckinKid[] }) {
  const [out, setOut] = useState<CheckinKid | null>(null);
  const [pickup, setPickup] = useState("");
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pad = useRef<SignaturePadHandle>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const here = kids.filter((k) => k.inAt && !k.outAt).length;

  const checkIn = (k: CheckinKid) => start(async () => {
    const r = await eventCheck({ dayId, personId: k.personId, action: "in" });
    if (r.ok) toast.success(`${k.name} checked in`); else toast.error(r.error);
    router.refresh();
  });

  return (
    <>
      <p className="mb-3 text-sm text-fg-secondary" role="status">{here} here now · {kids.filter((k) => k.outAt).length} picked up · {kids.filter((k) => !k.inAt).length} not arrived</p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Campers">
        {kids.map((k) => (
          <li key={k.personId} aria-label={k.name} className="flex flex-col gap-2 rounded-xl border border-default bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{k.name}</span>
              <Badge variant={k.outAt ? "outline" : k.inAt ? "secondary" : "outline"} className="ml-auto">{k.outAt ? "Picked up" : k.inAt ? "Here" : "Not arrived"}</Badge>
            </div>
            {k.allergies.length ? <p className="flex items-center gap-1 text-sm text-danger"><AlertTriangle aria-hidden className="size-4" /> Allergies: {k.allergies.join(", ")}</p> : null}
            <p className="text-xs text-fg-muted">{k.pickups.length ? `Pickup: ${k.pickups.join(", ")}` : "No authorized pickups on file — check ID."}</p>
            {k.outAt ? <p className="text-sm text-fg-secondary">Picked up by {k.pickedUpBy}</p> : null}
            <div className="mt-auto">
              {!k.inAt || k.outAt ? <Button className="h-12 w-full" disabled={pending} onClick={() => checkIn(k)}>{k.outAt ? "Check in again" : "Check in"}</Button>
                : <Button className="h-12 w-full" variant="outline" disabled={pending} onClick={() => { setOut(k); setPickup(k.pickups[0] ?? ""); setSigned(false); setError(null); }}>Check out</Button>}
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(out)} onOpenChange={(o) => { if (!o) setOut(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check out {out?.name}</DialogTitle>
            <DialogDescription>Who&apos;s picking up? They sign below.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const signature = pad.current?.toDataUrl();
            if (!signature) { setError("A signature is required at pickup."); return; }
            setError(null);
            start(async () => {
              const r = await eventCheck({ dayId, personId: out?.personId ?? "", action: "out", pickupName: pickup, signature });
              if (!r.ok) { setError(r.error); return; }
              toast.success(`${out?.name} checked out`);
              setOut(null);
              router.refresh();
            });
          }}>
            <div className="space-y-1">
              <Label htmlFor="pickup-name">Picked up by</Label>
              <Input id="pickup-name" list="pickup-names" value={pickup} onChange={(e) => setPickup(e.target.value)} autoComplete="off" />
              <datalist id="pickup-names">{out?.pickups.map((p) => <option key={p} value={p} />)}</datalist>
              {out && pickup && !out.pickups.includes(pickup) ? <p className="text-xs text-warning">Not on the authorized list — check ID.</p> : null}
            </div>
            <SignaturePad ref={pad} label="Pickup signature" onChange={setSigned} />
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending || !signed || pickup.trim().length < 2}>Confirm pickup</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
