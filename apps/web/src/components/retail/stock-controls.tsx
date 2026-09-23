"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { adjustStock, setReorderPoint } from "@/server/actions/retail";

export function AdjustStockDialog({ variantId, locationId, label, onHand }: { variantId: string; locationId: string; label: string; onHand: number }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<"receive" | "adjust" | "return" | "transfer">("receive");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline" aria-label={`Adjust stock for ${label}`}>Adjust</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock · {label}</DialogTitle>
          <DialogDescription>On hand now: {onHand}. Use a negative number to remove stock. Every change is kept in the movement ledger.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await adjustStock({ variantId, locationId, delta: Number(delta), reason, note });
            if (!r.ok) {
              setError(r.error);
              return;
            }
            toast.success("Stock updated");
            setOpen(false);
            setDelta("");
            setNote("");
            router.refresh();
          });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor={`d-${variantId}`}>Quantity (+/−)</Label><Input id={`d-${variantId}`} inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+12" /></div>
            <div className="space-y-1"><Label htmlFor={`r-${variantId}`}>Reason</Label>
              <select id={`r-${variantId}`} className={selectClass} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                <option value="receive" className="bg-surface">Received delivery</option>
                <option value="adjust" className="bg-surface">Count correction / damage</option>
                <option value="return" className="bg-surface">Customer return</option>
                <option value="transfer" className="bg-surface">Transfer</option>
              </select>
            </div>
          </div>
          <div className="space-y-1"><Label htmlFor={`n-${variantId}`}>Note{reason === "adjust" ? "" : " (optional)"}</Label><Input id={`n-${variantId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">Save adjustment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReorderPointInput({ variantId, locationId, value, label }: { variantId: string; locationId: string; value: number; label: string }) {
  const [v, setV] = useState(String(value));
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = () => {
    if (v === String(value)) return;
    start(async () => {
      const r = await setReorderPoint({ variantId, locationId, reorderPoint: Number(v) });
      if (r.ok) toast.success("Reorder point saved");
      else {
        toast.error(r.error);
        setV(String(value));
      }
      router.refresh();
    });
  };
  return (
    <Input aria-label={`Reorder point for ${label}`} value={v} disabled={pending} inputMode="numeric" className="h-8 w-20 text-right"
      onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
  );
}
