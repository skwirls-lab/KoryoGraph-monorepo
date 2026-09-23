"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { emailSaleReceipt, returnItems } from "@/server/actions/pos";

export function ReturnForm({ saleId, lines, currency, hasHousehold }: { saleId: string; lines: { id: string; label: string; returnable: number; unitTotalCents: number }[]; currency: string; hasHousehold: boolean }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [refundTo, setRefundTo] = useState<"original" | "credit">("original");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const chosen = Object.entries(qty).filter(([, n]) => n > 0).map(([lineId, n]) => ({ lineId, qty: n }));
  const estimate = lines.reduce((s, l) => s + (qty[l.id] ?? 0) * l.unitTotalCents, 0);
  if (!lines.some((l) => l.returnable > 0)) return <p className="text-sm text-fg-muted">Everything on this sale has been returned.</p>;
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await returnItems({ saleId, lines: chosen, refundTo, reason });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        toast.success(r.data.cashOutCents ? `Returned — give back ${formatMoney(r.data.cashOutCents, currency)} cash` : `Returned — refunded ${formatMoney(r.data.refundCents, currency)}`);
        setQty({});
        router.refresh();
      });
    }}>
      <ul className="space-y-2" aria-label="Return items">
        {lines.filter((l) => l.returnable > 0).map((l) => (
          <li key={l.id} className="flex items-center gap-2 text-sm">
            <Label htmlFor={`ret-${l.id}`} className="flex-1 font-normal">{l.label} <span className="text-fg-muted">(up to {l.returnable})</span></Label>
            <Input id={`ret-${l.id}`} type="number" min={0} max={l.returnable} value={qty[l.id] ?? 0} className="h-8 w-20" onChange={(e) => setQty({ ...qty, [l.id]: Math.max(0, Math.min(l.returnable, Number(e.target.value) || 0)) })} />
          </li>
        ))}
      </ul>
      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium">Refund to</legend>
        <label className="flex items-center gap-2"><input type="radio" name="refund" checked={refundTo === "original"} onChange={() => setRefundTo("original")} className="accent-[var(--color-primary)]" /> Original payment</label>
        <label className={`flex items-center gap-2 ${hasHousehold ? "" : "opacity-50"}`}><input type="radio" name="refund" disabled={!hasHousehold} checked={refundTo === "credit"} onChange={() => setRefundTo("credit")} className="accent-[var(--color-primary)]" /> Account credit{hasHousehold ? "" : " (needs a household)"}</label>
      </fieldset>
      <div className="space-y-1"><Label htmlFor="ret-reason">Reason</Label><Input id="ret-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Wrong size" /></div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending || !chosen.length}>Return {chosen.length ? `≈ ${formatMoney(estimate, currency)}` : "items"}</Button>
    </form>
  );
}

export function EmailSaleReceiptButton({ saleId }: { saleId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await emailSaleReceipt(saleId);
      if (!r.ok) toast.error(r.error);
      else if (r.data.status === "unsent_no_provider") toast.info("No email provider is configured, so the receipt is waiting in the Outbox.");
      else toast.success("Receipt sent");
    })}>Email receipt</Button>
  );
}
