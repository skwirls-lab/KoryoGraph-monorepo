"use client";

import { Award, Check, GraduationCap, Plus, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { approveForNextRank, awardStripe, enrollInProgram, promoteEnrollment, signOffSkill } from "@/server/actions/progress";

const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-fg";

export function AwardStripeButton({ enrollmentId, personId, disabled, size = "sm" }: { enrollmentId: string; personId: string; disabled?: boolean; size?: "sm" | "lg" }) {
  const [pending, start] = useTransition();
  return (
    <Button size={size} variant="secondary" className="gap-2" disabled={disabled || pending}
      onClick={() => start(async () => { const r = await awardStripe({ enrollmentId, personId }); if (r.ok) toast.success(`Stripe awarded (${r.data.stripes})`); else toast.error(r.error); })}>
      <Award aria-hidden className="size-4" /> Award stripe
    </Button>
  );
}

export function SignOffButton({ enrollmentId, skillId, skillName, personId }: { enrollmentId: string; skillId: string; skillName: string; personId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" className="gap-1" aria-label={`Sign off ${skillName}`} disabled={pending}
      onClick={() => start(async () => { const r = await signOffSkill({ enrollmentId, skillId, personId }); if (r.ok) toast.success(`Signed off ${skillName}`); else toast.error(r.error); })}>
      <Check aria-hidden className="size-4" /> Sign off
    </Button>
  );
}

export function ApproveButton({ enrollmentId, rankId, personId }: { enrollmentId: string; rankId: string; personId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" className="gap-1" disabled={pending}
      onClick={() => start(async () => { const r = await approveForNextRank({ enrollmentId, rankId, personId }); if (r.ok) toast.success("Approved for next rank"); else toast.error(r.error); })}>
      <ThumbsUp aria-hidden className="size-4" /> Approve
    </Button>
  );
}

export function PromoteDialog({ enrollmentId, personId, ladder, currentRankId, nextRankId }: {
  enrollmentId: string; personId: string; ladder: { id: string; name: string }[]; currentRankId: string | null; nextRankId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [rank, setRank] = useState(nextRankId ?? ladder[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-2"><GraduationCap aria-hidden className="size-4" /> Promote</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote</DialogTitle>
          <DialogDescription>Manual promotion outside a testing event. Stripes and the class count reset.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
          const r = await promoteEnrollment({ enrollmentId, toRankId: rank, reason, personId });
          if (r.ok) { toast.success("Promoted"); setOpen(false); setReason(""); } else toast.error(r.error);
        }); }}>
          <div className="space-y-1">
            <Label htmlFor={`to-${enrollmentId}`}>New rank</Label>
            <select id={`to-${enrollmentId}`} value={rank} onChange={(e) => setRank(e.target.value)} className={selectClass}>
              {ladder.map((r) => <option key={r.id} value={r.id} disabled={r.id === currentRankId} className="bg-surface">{r.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`reason-${enrollmentId}`}>Reason</Label>
            <Input id={`reason-${enrollmentId}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Transferred rank from previous school" />
          </div>
          <Button type="submit" disabled={pending || reason.trim().length < 3}>{pending ? "Promoting…" : "Promote"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EnrollDialog({ personId, programs }: { personId: string; programs: { id: string; name: string; ranks: { id: string; name: string }[] }[] }) {
  const [open, setOpen] = useState(false);
  const [program, setProgram] = useState(programs[0]?.id ?? "");
  const ranks = programs.find((p) => p.id === program)?.ranks ?? [];
  const [rank, setRank] = useState(ranks[0]?.id ?? "");
  const [pending, start] = useTransition();
  if (programs.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-2"><Plus aria-hidden className="size-4" /> Enroll in a program</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Enroll in a program</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
          const r = await enrollInProgram({ personId, programId: program, rankId: rank });
          if (r.ok) { toast.success("Enrolled"); setOpen(false); } else toast.error(r.error);
        }); }}>
          <div className="space-y-1">
            <Label htmlFor="enroll-program">Program</Label>
            <select id="enroll-program" value={program} onChange={(e) => { setProgram(e.target.value); setRank(programs.find((p) => p.id === e.target.value)?.ranks[0]?.id ?? ""); }} className={selectClass}>
              {programs.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="enroll-rank">Starting rank</Label>
            <select id="enroll-rank" value={rank} onChange={(e) => setRank(e.target.value)} className={selectClass}>
              {ranks.map((r) => <option key={r.id} value={r.id} className="bg-surface">{r.name}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={pending || !rank}>{pending ? "Enrolling…" : "Enroll"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
