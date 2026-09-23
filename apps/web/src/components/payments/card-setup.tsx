"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@koryo/ui/components/ui/dialog";
import { beginCardSetup, finishCardSetup } from "@/server/actions/payments";

interface Session {
  clientSecret: string;
  stripe: Promise<StripeJs | null>;
}

/**
 * "Add card": a SetupIntent on the school's connected account, confirmed with Stripe Elements. Card numbers
 * go straight to Stripe; the server re-reads the SetupIntent before recording the card.
 */
export function AddCardButton({ householdId, disabledReason }: { householdId: string; disabledReason?: string | null }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const open = () =>
    start(async () => {
      const r = await beginCardSetup(householdId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSession({ clientSecret: r.data.clientSecret, stripe: loadStripe(r.data.publishableKey, { stripeAccount: r.data.stripeAccount }) });
    });

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2" disabled={pending || Boolean(disabledReason)} title={disabledReason ?? undefined} onClick={open}>
        <CreditCard aria-hidden className="size-4" /> {pending ? "Opening…" : "Add card"}
      </Button>
      <Dialog open={Boolean(session)} onOpenChange={(o) => { if (!o) setSession(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a card</DialogTitle>
            <DialogDescription>The card is stored by Stripe and can be charged for future invoices.</DialogDescription>
          </DialogHeader>
          {session ? (
            <Elements stripe={session.stripe} options={{ clientSecret: session.clientSecret, appearance: { theme: "stripe" } }}>
              <SetupForm
                householdId={householdId}
                onDone={() => {
                  setSession(null);
                  router.refresh();
                }}
              />
            </Elements>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SetupForm({ householdId, onDone }: { householdId: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required", confirmParams: { return_url: window.location.href } });
    if (confirmError || !setupIntent) {
      setError(confirmError?.message ?? "The card couldn't be saved.");
      setBusy(false);
      return;
    }
    const r = await finishCardSetup({ householdId, setupIntentId: setupIntent.id });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success(r.data.last4 ? `Card ending ${r.data.last4} saved` : "Card saved");
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <PaymentElement />
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={!stripe || busy} className="w-full">{busy ? "Saving…" : "Save card"}</Button>
    </form>
  );
}
