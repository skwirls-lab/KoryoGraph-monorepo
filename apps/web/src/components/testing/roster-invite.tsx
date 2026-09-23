"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { inviteToTesting } from "@/server/actions/testing";

export interface RosterRow {
  enrollmentId: string;
  name: string;
  programName: string;
  currentRank: string | null;
  nextRank: string | null;
  status: "eligible" | "almost" | "not_yet";
  gaps: string[];
}

const GROUPS = [
  { key: "eligible", title: "Eligible", hint: "Every requirement for the next rank is met." },
  { key: "almost", title: "Almost", hint: "Small gaps left — invite with a reason if you're confident." },
  { key: "not_yet", title: "Not yet", hint: "Manual add: needs a reason." },
] as const;

export function RosterInvite({ eventId, rows, open }: { eventId: string; rows: RosterRow[]; open: boolean }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rows.filter((r) => r.status === "eligible").map((r) => r.enrollmentId)));
  const [reason, setReason] = useState("");
  const [showNotYet, setShowNotYet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const needsReason = rows.some((r) => picked.has(r.enrollmentId) && r.status !== "eligible");
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  if (!rows.length) return <p className="text-sm text-fg-muted">Everyone in these programs is already on the roster.</p>;
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.status === g.key);
        if (g.key === "not_yet" && !showNotYet) {
          return list.length ? <Button key={g.key} variant="ghost" size="sm" onClick={() => setShowNotYet(true)}>Show {list.length} not yet eligible (manual add)</Button> : null;
        }
        return (
          <section key={g.key} aria-labelledby={`roster-${g.key}`}>
            <h3 id={`roster-${g.key}`} className="text-sm font-semibold">{g.title} <span className="font-normal text-fg-muted">({list.length}) · {g.hint}</span></h3>
            {!list.length ? <p className="py-2 text-sm text-fg-muted">None.</p> : (
              <ul className="divide-y divide-default" aria-label={g.title}>
                {list.map((r) => (
                  <li key={r.enrollmentId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--color-primary)]" aria-label={`Invite ${r.name}`} checked={picked.has(r.enrollmentId)} onChange={() => toggle(r.enrollmentId)} />
                    <span className="font-medium">{r.name}</span>
                    <span className="text-fg-secondary">{r.programName}: {r.currentRank ?? "—"} → {r.nextRank ?? "—"}</span>
                    {r.gaps.map((gap) => <Badge key={gap} variant="outline">{gap}</Badge>)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {needsReason ? (
        <div className="space-y-1">
          <Label htmlFor="override-reason">Reason for inviting students who aren&apos;t eligible yet</Label>
          <Input id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Instructor confident — skills demonstrated in class" />
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button disabled={!open || pending || picked.size === 0} onClick={() => start(async () => {
        setError(null);
        const r = await inviteToTesting({ eventId, enrollmentIds: [...picked], overrideReason: reason });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        toast.success(`Invited ${r.data.invited} student${r.data.invited === 1 ? "" : "s"}`);
        setPicked(new Set());
        router.refresh();
      })}>Invite {picked.size} selected</Button>
      {!open ? <p className="text-xs text-fg-muted">Open the test for registration to send invitations.</p> : null}
    </div>
  );
}
