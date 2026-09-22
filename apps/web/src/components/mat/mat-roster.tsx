"use client";

import { describeGap } from "@koryo/eligibility";
import { AlertTriangle, CheckCircle2, Circle, CloudOff, Info, Phone, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RankBadge } from "@koryo/ui/components/app/rank-badge";
import { initials } from "@koryo/ui/components/app/person-chip";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@koryo/ui/components/ui/sheet";
import { cn } from "@koryo/ui/lib/utils";
import { NoteForm } from "@/components/people/person-controls";
import { AwardStripeButton, SignOffButton } from "@/components/progress/progress-actions";
import { enqueue, isNetworkError, pending as pendingItems, remove } from "@/lib/offline-queue";
import { setAttendance } from "@/server/actions/attendance";
import { searchPeople } from "@/server/actions/people";
import type { MatRosterRow } from "@/server/queries/mat";
import type { EnrollmentProgress } from "@/server/queries/progress";

const ELIG = { eligible: { label: "Eligible", cls: "border-success/50 text-success" }, almost: { label: "Almost", cls: "border-warning/50 text-warning" }, not_yet: { label: "Not yet", cls: "border-default text-fg-secondary" } } as const;

export function MatRoster({ sessionId, rows, progress, canPromote, disabled }: {
  sessionId: string; rows: MatRosterRow[]; progress: (EnrollmentProgress & { personId: string })[]; canPromote: boolean; disabled: boolean;
}) {
  const router = useRouter();
  const [present, setPresent] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.personId, r.attended])));
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState(true);
  const [card, setCard] = useState<MatRosterRow | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Adopt fresh server state after a refresh (server wins), keeping still-queued local toggles.
  const [lastRows, setLastRows] = useState(rows);
  if (lastRows !== rows) {
    setLastRows(rows);
    setPresent((prev) => ({ ...Object.fromEntries(rows.map((r) => [r.personId, r.attended])), ...Object.fromEntries([...queued].map((id) => [id, prev[id] ?? false])) }));
  }

  const replay = useCallback(async () => {
    const items = await pendingItems(sessionId);
    if (items.length === 0) return;
    setSyncing(true);
    let synced = 0;
    for (const item of items) {
      try {
        const r = await setAttendance({ sessionId: item.sessionId, personId: item.personId, present: item.present, source: "mat" });
        await remove(item.key);
        if (r.ok) synced++;
        else toast.error(`${r.error} (${rows.find((x) => x.personId === item.personId)?.name ?? "student"})`);
        setQueued((q) => { const n = new Set(q); n.delete(item.personId); return n; });
      } catch (err) {
        if (isNetworkError(err)) break;
        throw err;
      }
    }
    setSyncing(false);
    if (synced) { toast.success(`Synced ${synced} check-in${synced === 1 ? "" : "s"}`); router.refresh(); }
  }, [router, rows, sessionId]);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void replay();
    };
    update();
    void pendingItems(sessionId).then((items) => setQueued(new Set(items.map((i) => i.personId))));
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const t = window.setInterval(() => { if (navigator.onLine) void replay(); }, 15_000);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); window.clearInterval(t); };
  }, [replay, sessionId]);

  const toggle = async (row: MatRosterRow) => {
    const next = !present[row.personId];
    setPresent((p) => ({ ...p, [row.personId]: next }));
    const queueIt = async () => {
      await enqueue({ sessionId, personId: row.personId, present: next });
      setQueued((q) => new Set(q).add(row.personId));
    };
    if (!navigator.onLine) return queueIt();
    try {
      const r = await setAttendance({ sessionId, personId: row.personId, present: next, source: "mat" });
      if (!r.ok) { setPresent((p) => ({ ...p, [row.personId]: !next })); toast.error(r.error); }
    } catch (err) {
      if (isNetworkError(err)) await queueIt();
      else throw err;
    }
  };

  const count = Object.values(present).filter(Boolean).length;
  const cardProgress = card ? progress.find((p) => p.enrollmentId === card.enrollmentId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-secondary tabular" aria-live="polite">{count} of {rows.length} checked in</p>
        {!disabled ? <WalkIn sessionId={sessionId} existing={new Set(rows.map((r) => r.personId))} onAdded={() => router.refresh()} /> : null}
      </div>
      {!online || queued.size > 0 ? (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <CloudOff aria-hidden className="size-4" />
          {!online ? "Offline — " : syncing ? "Syncing — " : ""}{queued.size} check-in{queued.size === 1 ? "" : "s"} waiting to sync
        </p>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Roster">
        {rows.map((r) => {
          const on = Boolean(present[r.personId]);
          return (
            <li key={r.personId} className={cn("flex items-stretch overflow-hidden rounded-xl border bg-surface", on ? "border-success/60" : "border-default")}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={on}
                aria-label={`${r.name}, ${on ? "present" : "not checked in"}`}
                onClick={() => void toggle(r)}
                className="flex min-h-16 flex-1 items-center gap-3 px-3 py-2 text-left disabled:opacity-60"
              >
                {on ? <CheckCircle2 aria-hidden className="size-7 shrink-0 text-success" /> : <Circle aria-hidden className="size-7 shrink-0 text-fg-muted" />}
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-text">{initials(r.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}{queued.has(r.personId) ? <span className="ml-1 text-xs text-warning">(pending)</span> : null}</span>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
                    {r.rank ? r.rank.name : r.isExtra ? "Walk-in" : ""}
                    {r.rank && r.rank.stripes ? ` · ${r.rank.stripes} stripe${r.rank.stripes === 1 ? "" : "s"}` : ""}
                    {r.allergies.length || r.injuryFlags.length ? <AlertTriangle aria-label="Has safety flags" className="size-3.5 text-warning" /> : null}
                  </span>
                </span>
              </button>
              <button type="button" onClick={() => setCard(r)} aria-label={`Details for ${r.name}`} className="flex min-w-14 items-center justify-center border-l border-default text-fg-secondary hover:bg-elevated">
                <Info className="size-5" />
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet open={Boolean(card)} onOpenChange={(o) => !o && setCard(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          {card ? (
            <>
              <SheetHeader>
                <SheetTitle>{card.name}</SheetTitle>
                <SheetDescription>{card.rank ? card.rank.name : "No rank in this program"}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  {card.rank ? <RankBadge name={card.rank.name} beltColor={card.rank.color} stripes={card.rank.stripes} stripesMax={card.rank.stripesMax} /> : null}
                  {card.eligibility ? <Badge variant="outline" className={cn("bg-transparent", ELIG[card.eligibility].cls)}>{ELIG[card.eligibility].label}</Badge> : null}
                </div>
                {card.allergies.length || card.injuryFlags.length ? (
                  <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
                    {card.allergies.length ? <p><strong>Allergies:</strong> {card.allergies.join(", ")}</p> : null}
                    {card.injuryFlags.length ? <p><strong>Injuries:</strong> {card.injuryFlags.join(", ")}</p> : null}
                  </div>
                ) : null}
                {card.guardians.length ? (
                  <ul className="space-y-1 text-sm" aria-label="Guardians">
                    {card.guardians.map((g) => (
                      <li key={g.name} className="flex items-center gap-2"><Phone aria-hidden className="size-4 text-fg-muted" />{g.name}{g.phone ? <a href={`tel:${g.phone}`}>{g.phone}</a> : <span className="text-fg-muted">no phone</span>}</li>
                    ))}
                  </ul>
                ) : null}
                {cardProgress && canPromote && card.enrollmentId ? (
                  <div className="space-y-3">
                    <AwardStripeButton size="lg" enrollmentId={card.enrollmentId} personId={card.personId} disabled={!card.rank || card.rank.stripesMax === 0 || card.rank.stripes >= card.rank.stripesMax} />
                    {cardProgress.next ? (
                      <div>
                        <p className="text-sm font-medium">Sign off for {cardProgress.next.name}</p>
                        <ul className="mt-1 space-y-1">
                          {cardProgress.skills.map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                              <span className={s.signed ? "text-success" : undefined}>{s.signed ? "✓ " : "○ "}{s.name}</span>
                              {!s.signed ? <SignOffButton enrollmentId={card.enrollmentId as string} skillId={s.id} skillName={s.name} personId={card.personId} /> : null}
                            </li>
                          ))}
                        </ul>
                        {cardProgress.eligibility.gaps.length ? (
                          <ul className="mt-2 text-xs text-fg-secondary">{cardProgress.eligibility.gaps.map((g, i) => <li key={i}>{describeGap(g, (id) => cardProgress.skills.find((s) => s.id === id)?.name ?? "skill")}</li>)}</ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <NoteForm personId={card.personId} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function WalkIn({ sessionId, existing, onAdded }: { sessionId: string; existing: Set<string>; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; households: string[] }[]>([]);
  const [pendingSearch, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="min-h-11 gap-2"><UserPlus aria-hidden className="size-4" /> Add walk-in</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a walk-in</DialogTitle></DialogHeader>
        <label className="block">
          <span className="sr-only">Search students</span>
          <Input autoFocus value={q} placeholder="Search by name" onChange={(e) => { const v = e.target.value; setQ(v); start(async () => { const r = await searchPeople(v); setResults(r.ok ? r.data : []); }); }} />
        </label>
        <ul className="max-h-72 space-y-1 overflow-y-auto" aria-busy={pendingSearch}>
          {results.filter((p) => !existing.has(p.id)).map((p) => (
            <li key={p.id}>
              <button type="button" className="flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-left hover:bg-elevated"
                onClick={async () => {
                  const r = await setAttendance({ sessionId, personId: p.id, present: true, source: "mat" });
                  if (r.ok) { toast.success(`${p.name} checked in`); setOpen(false); setQ(""); onAdded(); } else toast.error(r.error);
                }}>
                <span>{p.name}</span><span className="text-xs text-fg-muted">{p.households.join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
