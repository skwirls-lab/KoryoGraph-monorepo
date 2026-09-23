"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { cardLabel } from "@/lib/payments";
import { parseMoney } from "@/lib/curriculum";
import { addInvoiceLineAction, applyCreditToInvoice, emailReceipt, takeInvoicePayment, voidInvoiceAction } from "@/server/actions/billing";
import { refundPaymentAction } from "@/server/actions/payments";
import type { SavedCard } from "@/server/queries/payments";

const dollars = (c: number) => (c / 100).toFixed(2);

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, done?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "Something went wrong");
        return;
      }
      toast.success(success);
      done?.();
      router.refresh();
    });
  };
  return { pending, error, setError, run };
}

export function InvoiceActions(props: {
  invoiceId: string;
  status: string;
  balanceCents: number;
  paidCents: number;
  cards: SavedCard[];
  creditCents: number;
  canCharge: boolean;
  currency: string;
}) {
  const { invoiceId, status, balanceCents, canCharge } = props;
  const receipt = useAction();
  const credit = useAction();
  const open = !["void", "refunded", "draft"].includes(status);
  return (
    <div className="flex flex-wrap gap-2">
      {canCharge && open && balanceCents > 0 ? <TakePaymentDialog {...props} /> : null}
      {canCharge && open && balanceCents > 0 && props.creditCents > 0 ? (
        <Button variant="outline" size="sm" disabled={credit.pending} onClick={() => credit.run(() => applyCreditToInvoice(invoiceId), "Credit applied")}>
          Apply {formatMoney(Math.min(props.creditCents, balanceCents), props.currency)} credit
        </Button>
      ) : null}
      {canCharge && open ? <AddLineDialog invoiceId={invoiceId} /> : null}
      {canCharge && status !== "void" && props.paidCents === 0 ? <VoidDialog invoiceId={invoiceId} /> : null}
      {props.paidCents > 0 ? (
        <Button variant="outline" size="sm" disabled={receipt.pending}
          onClick={() => receipt.run(async () => {
            const r = await emailReceipt(invoiceId);
            if (r.ok && r.data.status === "unsent_no_provider") toast.info("No email provider is configured, so the receipt is waiting in the Outbox.");
            return r;
          }, "Receipt recorded")}>
          Email receipt
        </Button>
      ) : null}
      {receipt.error ? <p role="alert" className="w-full text-sm text-danger">{receipt.error}</p> : null}
      {credit.error ? <p role="alert" className="w-full text-sm text-danger">{credit.error}</p> : null}
    </div>
  );
}

function TakePaymentDialog({ invoiceId, balanceCents, cards, currency }: { invoiceId: string; balanceCents: number; cards: SavedCard[]; currency: string }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"card" | "cash" | "check" | "external">("cash");
  const [amount, setAmount] = useState(dollars(balanceCents));
  const [cardId, setCardId] = useState(cards.find((c) => c.is_default)?.id ?? cards[0]?.id ?? "");
  const [memo, setMemo] = useState("");
  const [attemptKey, setAttemptKey] = useState("");
  const a = useAction();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents) {
      a.setError("Enter an amount like 25.00");
      return;
    }
    a.run(async () => {
      const r = method === "card"
        ? await takeInvoicePayment({ invoiceId, method: "card", amountCents: cents, paymentMethodId: cardId, attemptKey })
        : await takeInvoicePayment({ invoiceId, method, amountCents: cents, memo: method === "check" && memo ? `Check ${memo}` : memo });
      if (!r.ok && method === "card") setAttemptKey(crypto.randomUUID());
      return r;
    }, "Payment recorded", () => setOpen(false));
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setAttemptKey(crypto.randomUUID()); setAmount(dollars(balanceCents)); a.setError(null); } }}>
      <DialogTrigger asChild><Button size="sm">Take payment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>Balance due {formatMoney(balanceCents, currency)}. Paying more leaves the rest as account credit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <fieldset className="flex flex-wrap gap-3 text-sm">
            <legend className="mb-1 w-full text-sm font-medium">Method</legend>
            {cards.length ? <label className="flex items-center gap-1.5"><input type="radio" name="method" checked={method === "card"} onChange={() => setMethod("card")} className="accent-[var(--color-primary)]" /> Card on file</label> : null}
            {(["cash", "check", "external"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5 capitalize"><input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--color-primary)]" /> {m === "external" ? "Other (bank transfer…)" : m}</label>
            ))}
          </fieldset>
          {method === "card" ? (
            <div className="space-y-1">
              <Label htmlFor="pay-card">Card</Label>
              <select id="pay-card" className={selectClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
                {cards.map((c) => <option key={c.id} value={c.id} className="bg-surface">{cardLabel(c)}</option>)}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {method === "check" || method === "external" ? (
            <div className="space-y-1">
              <Label htmlFor="pay-memo">{method === "check" ? "Check number" : "Reference"}</Label>
              <Input id="pay-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={60} />
            </div>
          ) : null}
          {a.error ? <p role="alert" className="text-sm text-danger">{a.error}</p> : null}
          <Button type="submit" disabled={a.pending} className="w-full">{a.pending ? "Recording…" : "Record payment"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddLineDialog({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"fee" | "product" | "adjustment" | "discount">("fee");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const a = useAction();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); a.setError(null); }}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Add line</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a line</DialogTitle>
          <DialogDescription>A discount lowers the total; an adjustment can be negative (e.g. −10.00).</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); a.run(() => addInvoiceLineAction({ invoiceId, kind, description, quantity: 1, amount }), "Line added", () => { setOpen(false); setDescription(""); setAmount(""); }); }}>
          <div className="space-y-1">
            <Label htmlFor="line-kind">Kind</Label>
            <select id="line-kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="fee" className="bg-surface">Fee</option>
              <option value="product" className="bg-surface">Product</option>
              <option value="adjustment" className="bg-surface">Adjustment</option>
              <option value="discount" className="bg-surface">Discount</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="line-desc">Description</Label>
            <Input id="line-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="line-amount">Amount</Label>
            <Input id="line-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00" />
          </div>
          {a.error ? <p role="alert" className="text-sm text-danger">{a.error}</p> : null}
          <Button type="submit" disabled={a.pending} className="w-full">Add line</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const a = useAction();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); a.setError(null); }}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-danger">Void</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this invoice?</DialogTitle>
          <DialogDescription>The invoice stays on record as void and no longer counts toward the balance.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); a.run(() => voidInvoiceAction({ invoiceId, reason }), "Invoice voided", () => setOpen(false)); }}>
          <div className="space-y-1">
            <Label htmlFor="void-reason">Reason</Label>
            <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
          {a.error ? <p role="alert" className="text-sm text-danger">{a.error}</p> : null}
          <Button type="submit" variant="destructive" disabled={a.pending} className="w-full">Void invoice</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RefundButton({ paymentId, maxCents, method, currency }: { paymentId: string; maxCents: number; method: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(dollars(maxCents));
  const [reason, setReason] = useState("");
  const [toCredit, setToCredit] = useState(method === "credit");
  const a = useAction();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents || cents > maxCents) {
      a.setError(`Enter an amount up to ${formatMoney(maxCents, currency)}`);
      return;
    }
    a.run(() => refundPaymentAction({ paymentId, amountCents: cents, reason, asCredit: toCredit }), toCredit ? "Credit note issued" : "Refund recorded", () => setOpen(false));
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); a.setError(null); }}>
      <DialogTrigger asChild><Button variant="ghost" size="sm">Refund</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund payment</DialogTitle>
          <DialogDescription>Up to {formatMoney(maxCents, currency)}. Every refund is recorded with a numbered credit note.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="refund-amount">Amount</Label>
            <Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="refund-reason">Reason</Label>
            <Input id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
          <fieldset className="space-y-1 text-sm">
            <legend className="mb-1 font-medium">Refund to</legend>
            {method !== "credit" ? <label className="flex items-center gap-2"><input type="radio" name="dest" checked={!toCredit} onChange={() => setToCredit(false)} className="accent-[var(--color-primary)]" /> Original method ({method}){method === "cash" || method === "check" ? " — hand the money back" : ""}</label> : null}
            <label className="flex items-center gap-2"><input type="radio" name="dest" checked={toCredit} onChange={() => setToCredit(true)} className="accent-[var(--color-primary)]" /> Account credit</label>
          </fieldset>
          {a.error ? <p role="alert" className="text-sm text-danger">{a.error}</p> : null}
          <Button type="submit" disabled={a.pending} className="w-full">{a.pending ? "Refunding…" : "Refund"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
