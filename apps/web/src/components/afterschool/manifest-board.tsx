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
import { SignaturePad, type SignaturePadHandle } from "@/components/events/signature-pad";
import type { MarkInput } from "@/lib/validation/afterschool";
import { markAfterschool } from "@/server/actions/afterschool";

export interface ManifestKid {
  enrollmentId: string;
  name: string;
  school: string;
  route: string;
  allergies: string[];
  pickups: string[];
  pickedUpAt: string | null;
  arrivedAt: string | null;
  releasedAt: string | null;
  releasedTo: string | null;
  absent: boolean;
  absenceReason: string | null;
  alerted: boolean;
}

const time = (iso: string | null, tz: string) => (iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, timeStyle: "short" }) : "");

function status(k: ManifestKid, tz: string): { label: string; variant: "secondary" | "outline" | "destructive" } {
  if (k.absent) return { label: k.alerted ? "Absent · family alerted" : "Absent", variant: "destructive" };
  if (k.releasedAt) return { label: `Released ${time(k.releasedAt, tz)} to ${k.releasedTo}`, variant: "outline" };
  if (k.arrivedAt) return { label: `Here since ${time(k.arrivedAt, tz)}`, variant: "secondary" };
  if (k.pickedUpAt) return { label: `Picked up ${time(k.pickedUpAt, tz)}`, variant: "secondary" };
  return { label: "Expected", variant: "outline" };
}

/** The day's manifest grouped by route and school, with pickup → arrival → release (signed) or absence. */
export function ManifestBoard({ date, kids, tz }: { date: string; kids: ManifestKid[]; tz: string }) {
  const [release, setRelease] = useState<ManifestKid | null>(null);
  const [absent, setAbsent] = useState<ManifestKid | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pad = useRef<SignaturePadHandle>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const mark = (k: ManifestKid, input: Omit<MarkInput, "enrollmentId" | "date">, done?: () => void) => start(async () => {
    const r = await markAfterschool({ enrollmentId: k.enrollmentId, date, ...input });
    if (!r.ok) { if (done) setError(r.error); else toast.error(r.error); return; }
    done?.();
    router.refresh();
  });
  const routes = [...new Set(kids.map((k) => k.route))];

  return (
    <>
      {routes.map((route) => {
        const onRoute = kids.filter((k) => k.route === route);
        const schools = [...new Set(onRoute.map((k) => k.school))];
        return (
          <section key={route} aria-label={`Route ${route}`} className="mb-6 break-inside-avoid rounded-xl border border-default bg-surface p-4 print:border-black">
            <h2 className="mb-2 text-lg font-semibold">Route: {route} <span className="text-sm font-normal text-fg-muted">({onRoute.length})</span></h2>
            {schools.map((school) => (
              <div key={school} className="mb-3">
                <h3 className="mb-1 text-sm font-semibold text-fg-secondary">{school}</h3>
                <ul className="divide-y divide-default" aria-label={`${route} · ${school}`}>
                  {onRoute.filter((k) => k.school === school).map((k) => {
                    const s = status(k, tz);
                    return (
                      <li key={k.enrollmentId} aria-label={k.name} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                        <span className="hidden size-4 rounded-sm border border-strong print:inline-block" aria-hidden />
                        <span className="font-medium">{k.name}</span>
                        {k.allergies.length ? <span className="inline-flex items-center gap-0.5 text-xs text-danger"><AlertTriangle aria-hidden className="size-3" />{k.allergies.join(", ")}</span> : null}
                        <Badge variant={s.variant}>{s.label}</Badge>
                        {k.absenceReason ? <span className="text-xs text-fg-muted">{k.absenceReason}</span> : null}
                        <span className="ml-auto flex flex-wrap gap-1 print:hidden">
                          {!k.absent && !k.pickedUpAt ? <Button size="sm" variant="outline" disabled={pending} onClick={() => mark(k, { action: "picked_up" })}>Picked up</Button> : null}
                          {!k.absent && !k.arrivedAt ? <Button size="sm" variant="outline" disabled={pending} onClick={() => mark(k, { action: "arrived" })}>Arrived</Button> : null}
                          {k.arrivedAt && !k.releasedAt ? <Button size="sm" disabled={pending} onClick={() => { setRelease(k); setName(k.pickups[0] ?? ""); setSigned(false); setError(null); }}>Release</Button> : null}
                          {!k.absent && !k.releasedAt && !k.arrivedAt ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setAbsent(k); setReason(""); setError(null); }}>Absent</Button> : null}
                          {k.absent ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => mark(k, { action: "present" })}>Undo absent</Button> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
      <Dialog open={Boolean(absent)} onOpenChange={(o) => { if (!o) setAbsent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {absent?.name} absent</DialogTitle>
            <DialogDescription>Their guardians are alerted by email/SMS (consent and quiet hours apply).</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (absent) mark(absent, { action: "absent", reason }, () => { toast.success(`${absent.name} marked absent — family alerted`); setAbsent(null); }); }}>
            <div className="space-y-1"><Label htmlFor="abs-reason">Reason (optional)</Label><Input id="abs-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Not at the school door" maxLength={200} /></div>
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={pending}>Mark absent and alert</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(release)} onOpenChange={(o) => { if (!o) setRelease(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release {release?.name}</DialogTitle>
            <DialogDescription>Who&apos;s picking up? They sign below.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const signature = pad.current?.toDataUrl();
            if (!signature || !release) { setError("A signature is required at pickup."); return; }
            mark(release, { action: "released", releasedTo: name, signature }, () => { toast.success(`${release.name} released`); setRelease(null); });
          }}>
            <div className="space-y-1">
              <Label htmlFor="rel-name">Picked up by</Label>
              <Input id="rel-name" list="rel-names" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              <datalist id="rel-names">{release?.pickups.map((p) => <option key={p} value={p} />)}</datalist>
              {release && name && !release.pickups.includes(name) ? <p className="text-xs text-warning">Not on the authorized list — check ID.</p> : null}
            </div>
            <SignaturePad ref={pad} label="Pickup signature" onChange={setSigned} />
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending || !signed || name.trim().length < 2}>Confirm release</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
