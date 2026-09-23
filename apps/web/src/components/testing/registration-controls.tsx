"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { bulkPromote, registerForTesting, registerOnBehalf, setRegistrationStatus, setTestingStatus } from "@/server/actions/testing";

export function RegistrationActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => start(async () => { const r = await fn(); if (r.ok) toast.success(msg); else toast.error(r.error); router.refresh(); });
  return (
    <div className="flex gap-1">
      {status === "invited" ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => registerOnBehalf(id), "Registered")}>Register</Button> : null}
      {status === "paid" ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setRegistrationStatus({ registrationId: id, status: "confirmed" }), "Confirmed")}>Confirm</Button> : null}
      {["invited", "registered", "paid", "confirmed"].includes(status) ? <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => setRegistrationStatus({ registrationId: id, status: "withdrawn" }), "Withdrawn")}>Withdraw</Button> : null}
    </div>
  );
}

export function EventStatusButtons({ eventId, status }: { eventId: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (s: "open" | "closed" | "draft") => start(async () => { const r = await setTestingStatus({ eventId, status: s }); if (!r.ok) toast.error(r.error); router.refresh(); });
  return (
    <div className="flex gap-2">
      {status !== "open" && status !== "completed" ? <Button size="sm" variant="outline" disabled={pending} onClick={() => set("open")}>Open registration</Button> : null}
      {status === "open" ? <Button size="sm" variant="outline" disabled={pending} onClick={() => set("closed")}>Close registration</Button> : null}
    </div>
  );
}

export function PromoteForm({ eventId, rows }: { eventId: string; rows: { id: string; name: string; toRank: string | null; status: string }[] }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rows.map((r) => r.id)));
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!rows.length) return <p className="text-sm text-fg-muted">No one is waiting for promotion. Scores decide who passed.</p>;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-default" aria-label="Ready to promote">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--color-primary)]" aria-label={`Promote ${r.name}`} checked={picked.has(r.id)}
              onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
            <span className="font-medium">{r.name}</span>
            <span className="text-fg-secondary">→ {r.toRank}</span>
            {r.status === "conditional" ? <span className="text-xs text-warning">conditional pass</span> : null}
          </li>
        ))}
      </ul>
      <Button disabled={pending || !picked.size} onClick={() => start(async () => {
        const r = await bulkPromote({ eventId, registrationIds: [...picked] });
        if (!r.ok) toast.error(r.error);
        else toast.success(`Promoted ${r.data.promoted} · ${r.data.certificates} certificate${r.data.certificates === 1 ? "" : "s"} ready`);
        router.refresh();
      })}>Promote {picked.size} selected</Button>
    </div>
  );
}

export function HomeRegisterButton({ registrationId, name }: { registrationId: string; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await registerForTesting(registrationId);
      if (r.ok) toast.success(`${name} is registered${r.data.invoiceId ? " — the testing fee is on Billing" : ""}`);
      else toast.error(r.error);
      router.refresh();
    })}>Register {name}</Button>
  );
}
