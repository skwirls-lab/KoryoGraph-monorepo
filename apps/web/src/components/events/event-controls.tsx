"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { cancelRegistration, createGuestLink, createPartyDeposit, setEventStatus, signatureUrl } from "@/server/actions/events";

type Status = "draft" | "open" | "closed" | "completed" | "cancelled";
const NEXT: Record<Status, { to: Status; label: string }[]> = {
  draft: [{ to: "open", label: "Open registration" }],
  open: [{ to: "closed", label: "Close registration" }, { to: "cancelled", label: "Cancel event" }],
  closed: [{ to: "open", label: "Reopen" }, { to: "completed", label: "Mark completed" }],
  completed: [],
  cancelled: [{ to: "draft", label: "Restore as draft" }],
};

export function EventStatusButtons({ eventId, status }: { eventId: string; status: Status }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      {NEXT[status].map((n) => (
        <Button key={n.to} size="sm" variant={n.to === "cancelled" ? "ghost" : "outline"} disabled={pending}
          onClick={() => start(async () => { const r = await setEventStatus({ eventId, status: n.to }); if (!r.ok) toast.error(r.error); router.refresh(); })}>{n.label}</Button>
      ))}
    </>
  );
}

export function CancelRegistrationButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button size="sm" variant="ghost" disabled={pending} aria-label={`Cancel ${name}'s registration`}
      onClick={() => { if (!confirm(`Cancel ${name}'s registration? An unpaid invoice is voided.`)) return; start(async () => { const r = await cancelRegistration({ registrationId: id }); if (r.ok) toast.success("Registration cancelled"); else toast.error(r.error); router.refresh(); }); }}>Cancel</Button>
  );
}

/** Guest waiver link: shown once when created (only its hash is stored); creating a new one replaces it. */
export function GuestLinkPanel({ eventId, hasLink, origin }: { eventId: string; hasLink: boolean; origin: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {link ? (
        <div className="flex gap-2">
          <Input readOnly value={link} aria-label="Guest waiver link" onFocus={(e) => e.currentTarget.select()} />
          <Button size="sm" variant="outline" className="gap-1" onClick={() => { void navigator.clipboard.writeText(link).then(() => toast.success("Link copied")); }}><Copy className="size-4" /> Copy</Button>
        </div>
      ) : <p className="text-sm text-fg-secondary">{hasLink ? "A guest link was shared. Create a new one to see it again (the old link stops working)." : "Share a link with the host so guests' parents can sign the waiver without an account."}</p>}
      <Button size="sm" variant={hasLink || link ? "ghost" : "outline"} disabled={pending}
        onClick={() => start(async () => { const r = await createGuestLink({ eventId }); if (r.ok) setLink(`${origin}/sign/party/${r.data.token}`); else toast.error(r.error); })}>
        {hasLink || link ? "New guest link" : "Create guest link"}
      </Button>
    </div>
  );
}

export function DepositButton({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button size="sm" variant="outline" disabled={pending}
      onClick={() => start(async () => { const r = await createPartyDeposit({ eventId }); if (r.ok) toast.success("Deposit invoice created"); else toast.error(r.error); router.refresh(); })}>Invoice the deposit</Button>
  );
}

export function SignatureLink({ path, name }: { path: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="link" className="h-auto p-0" disabled={pending} aria-label={`View ${name}'s pickup signature`}
      onClick={() => start(async () => { const r = await signatureUrl({ path }); if (r.ok) window.open(r.data.url, "_blank", "noopener"); else toast.error(r.error); })}>signature</Button>
  );
}
