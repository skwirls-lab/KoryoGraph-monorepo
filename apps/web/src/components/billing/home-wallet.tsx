"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { Switch } from "@koryo/ui/components/ui/switch";
import { requestHold, setAutopay, startInvoicePayment } from "@/server/actions/wallet";

interface PaySession {
  clientSecret: string;
  stripe: Promise<StripeJs | null>;
  amountCents: number;
}

/** Pay an invoice with a card (Elements). The invoice shows as paid once Stripe's webhook confirms. */
export function PayInvoiceButton({ invoiceId, number, currency }: { invoiceId: string; number: number; currency: string }) {
  const [session, setSession] = useState<PaySession | null>(null);
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const [processing, setProcessing] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!processing) return;
    // Wait for the webhook to land, refreshing a few times.
    let n = 0;
    const timer = setInterval(() => {
      n++;
      router.refresh();
      if (n >= 10) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [processing, router]);

  if (processing) return <span role="status" className="text-sm text-fg-secondary">Payment processing — it shows as paid once Stripe confirms.</span>;
  return (
    <>
      <Button size="sm" disabled={pending} onClick={() => start(async () => {
        const r = await startInvoicePayment({ invoiceId, attemptKey });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setSession({ clientSecret: r.data.clientSecret, amountCents: r.data.amountCents, stripe: loadStripe(r.data.publishableKey, { stripeAccount: r.data.stripeAccount }) });
      })}>
        {pending ? "Opening…" : "Pay now"}
      </Button>
      <Dialog open={Boolean(session)} onOpenChange={(o) => { if (!o) { setSession(null); setAttemptKey(crypto.randomUUID()); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay invoice #{number}</DialogTitle>
            <DialogDescription>{session ? `${formatMoney(session.amountCents, currency)} by card. The card is saved for next time.` : ""}</DialogDescription>
          </DialogHeader>
          {session ? (
            <Elements stripe={session.stripe} options={{ clientSecret: session.clientSecret, appearance: { theme: "stripe" } }}>
              <PayForm amountLabel={formatMoney(session.amountCents, currency)} onPaid={() => { setSession(null); setProcessing(true); toast.success("Payment sent"); }} />
            </Elements>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PayForm({ amountLabel, onPaid }: { amountLabel: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      setBusy(true);
      setError(null);
      const { error: err } = await stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: window.location.href } });
      setBusy(false);
      if (err) setError(err.message ?? "The payment didn't go through.");
      else onPaid();
    }}>
      <PaymentElement />
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={!stripe || busy} className="w-full">{busy ? "Paying…" : `Pay ${amountLabel}`}</Button>
    </form>
  );
}

export function AutopaySwitch({ membershipId, enabled, planName, disabled }: { membershipId: string; enabled: boolean; planName: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = `autopay-${membershipId}`;
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={enabled} disabled={pending || disabled} aria-label={`Autopay for ${planName}`}
        onCheckedChange={(on) => start(async () => {
          const r = await setAutopay({ membershipId, enabled: on });
          if (r.ok) toast.success(on ? "Autopay is on" : "Autopay is off");
          else toast.error(r.error);
          router.refresh();
        })} />
      <Label htmlFor={id} className="text-sm font-normal">Autopay</Label>
    </div>
  );
}

export function HoldRequestDialog({ membershipId, planName, today }: { membershipId: string; planName: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Request a hold</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a hold</DialogTitle>
          <DialogDescription>Ask the school to pause {planName} (travel, injury…). They&apos;ll confirm and adjust billing.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await requestHold({ membershipId, from, until, reason });
            if (!r.ok) {
              setError(r.error);
              return;
            }
            toast.success("Hold requested — the school will confirm");
            setOpen(false);
          });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="hold-from">From</Label><Input id="hold-from" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="hold-until">Until</Label><Input id="hold-until" type="date" min={from} value={until} onChange={(e) => setUntil(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="hold-reason">Reason (optional)</Label><Input id="hold-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">Send request</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
