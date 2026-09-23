"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { chargeSavedCard } from "@/server/actions/payments";
import type { SavedCard } from "@/server/queries/payments";
import { cardLabel } from "./saved-cards";

const selectCls = "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-fg";

/** Charge a saved card (customer not present). Amounts not tied to an invoice land as household credit. */
export function ChargeCardButton({ householdId, cards }: { householdId: string; cards: SavedCard[] }) {
  const [open, setOpen] = useState(false);
  const [attemptKey, setAttemptKey] = useState("");
  const [amount, setAmount] = useState("");
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 50) {
      setError("Enter an amount of at least $0.50");
      return;
    }
    setError(null);
    start(async () => {
      const r = await chargeSavedCard({ householdId, paymentMethodId: cardId, amountCents: cents, memo, attemptKey });
      if (!r.ok) {
        setError(r.error);
        setAttemptKey(crypto.randomUUID()); // a declined attempt may be retried as a new charge
        router.refresh();
        return;
      }
      toast.success(r.data.status === "succeeded" ? "Payment succeeded" : "Payment is processing");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setAttemptKey(crypto.randomUUID()); setError(null); } }}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!cards.length}>Charge card</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Charge a saved card</DialogTitle>
          <DialogDescription>Anything not applied to an invoice is kept as account credit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="charge-amount">Amount (USD)</Label>
            <Input id="charge-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="charge-card">Card</Label>
            <select id="charge-card" className={selectCls} value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {cards.map((c) => <option key={c.id} value={c.id} className="bg-surface">{cardLabel(c)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="charge-memo">Memo (optional)</Label>
            <Input id="charge-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200} />
          </div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Charging…" : "Charge"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
