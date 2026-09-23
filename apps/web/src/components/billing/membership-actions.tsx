"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { endMembershipHold, scheduleCancellation, setMembershipHold } from "@/server/actions/billing";

export function MembershipActions({ membershipId, status, planName, today, holdFrom }: { membershipId: string; status: string; planName: string; today: string; holdFrom: string | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (["cancelled", "expired"].includes(status)) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {status === "on_hold" || holdFrom ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
          const r = await endMembershipHold(membershipId);
          if (r.ok) toast.success("Hold removed");
          else toast.error(r.error);
          router.refresh();
        })}>End hold</Button>
      ) : <HoldDialog membershipId={membershipId} planName={planName} today={today} />}
      <CancelDialog membershipId={membershipId} planName={planName} today={today} />
    </div>
  );
}

export function HoldDialog({ membershipId, planName, today, initial, taskId, label = "Hold" }: { membershipId: string; planName: string; today: string; initial?: { from: string; until: string }; taskId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(initial?.from ?? today);
  const [until, setUntil] = useState(initial?.until ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">{label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Put {planName} on hold</DialogTitle>
          <DialogDescription>Billing is prorated for the held days; the membership resumes automatically.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await setMembershipHold({ membershipId, from, until, taskId });
            if (!r.ok) {
              setError(r.error);
              return;
            }
            toast.success("Hold scheduled");
            setOpen(false);
            router.refresh();
          });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor={`hf-${membershipId}`}>From</Label><Input id={`hf-${membershipId}`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor={`hu-${membershipId}`}>Until</Label><Input id={`hu-${membershipId}`} type="date" value={until} min={from} onChange={(e) => setUntil(e.target.value)} /></div>
          </div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">Schedule hold</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ membershipId, planName, today }: { membershipId: string; planName: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [cancelAt, setCancelAt] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger asChild><Button size="sm" variant="ghost" className="text-danger">Cancel</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {planName}</DialogTitle>
          <DialogDescription>No new invoices are created from the cancellation date. Existing invoices stay as they are.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await scheduleCancellation({ membershipId, cancelAt, reason });
            if (!r.ok) {
              setError(r.error);
              return;
            }
            toast.success(cancelAt <= today ? "Membership cancelled" : `Cancels on ${cancelAt}`);
            setOpen(false);
            router.refresh();
          });
        }}>
          <div className="space-y-1"><Label htmlFor={`ca-${membershipId}`}>Cancellation date</Label><Input id={`ca-${membershipId}`} type="date" value={cancelAt} onChange={(e) => setCancelAt(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor={`cr-${membershipId}`}>Reason</Label><Input id={`cr-${membershipId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="destructive" disabled={pending} className="w-full">Cancel membership</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
