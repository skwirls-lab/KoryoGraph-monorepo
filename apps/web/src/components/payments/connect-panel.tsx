"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { refreshStripeStatus, registerCardReader, startStripeOnboarding } from "@/server/actions/payments";

export function ConnectButtons({ connected, complete }: { connected: boolean; complete: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {!complete ? (
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await startStripeOnboarding();
          if (r.ok) window.location.assign(r.data.url);
          else toast.error(r.error);
        })}>
          {connected ? "Continue Stripe onboarding" : "Connect Stripe"}
        </Button>
      ) : null}
      {connected ? (
        <Button variant="outline" disabled={pending} onClick={() => start(async () => {
          const r = await refreshStripeStatus();
          if (r.ok) toast.success(r.data.complete ? "Stripe is ready to take payments" : "Stripe still needs more information");
          else toast.error(r.error);
          router.refresh();
        })}>
          Refresh status
        </Button>
      ) : null}
    </div>
  );
}

export function RegisterReaderForm() {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("Front desk");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await registerCardReader({ registrationCode: code, label });
          if (!r.ok) {
            setError(r.error);
            return;
          }
          setError(null);
          setCode("");
          toast.success("Reader registered");
          router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="reader-code">Registration code</Label>
        <Input id="reader-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. simulated-wpe in test mode" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reader-label">Label</Label>
        <Input id="reader-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <Button type="submit" disabled={pending}>Register reader</Button>
      {error ? <p role="alert" className="text-sm text-danger sm:col-span-3">{error}</p> : null}
    </form>
  );
}
