"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { parseMoney } from "@/lib/curriculum";
import { closeDrawer, openDrawer } from "@/server/actions/pos";

export function DrawerControls({ locationId, drawer, currency }: { locationId: string; drawer: { id: string; openingCents: number; expectedCents: number } | null; currency: string }) {
  const money = (c: number) => formatMoney(c, currency);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ expectedCents: number; countedCents: number; varianceCents: number } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{drawer ? <>Cash drawer open · expected <strong className="tabular">{money(drawer.expectedCents)}</strong></> : "Cash drawer closed"}</span>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); setValue(""); if (o) setResult(null); }}>
        <DialogTrigger asChild><Button size="sm" variant="outline">{drawer ? "Close drawer" : "Open drawer"}</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{drawer ? "Close the cash drawer" : "Open the cash drawer"}</DialogTitle>
            <DialogDescription>{drawer ? "Count the cash in the drawer. We'll compare it with what the sales say should be there." : "Count the starting float."}</DialogDescription>
          </DialogHeader>
          {result ? (
            <dl className="space-y-1 text-sm" role="status">
              <div className="flex justify-between"><dt>Expected</dt><dd className="tabular">{money(result.expectedCents)}</dd></div>
              <div className="flex justify-between"><dt>Counted</dt><dd className="tabular">{money(result.countedCents)}</dd></div>
              <div className={`flex justify-between font-semibold ${result.varianceCents ? "text-danger" : "text-success"}`}><dt>Variance</dt><dd className="tabular">{result.varianceCents > 0 ? "+" : ""}{money(result.varianceCents)}</dd></div>
            </dl>
          ) : (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const cents = parseMoney(value);
              if (cents === null) {
                setError("Enter an amount like 150.00");
                return;
              }
              start(async () => {
                if (drawer) {
                  const r = await closeDrawer({ drawerId: drawer.id, countedCents: cents });
                  if (!r.ok) return setError(r.error);
                  setResult(r.data);
                } else {
                  const r = await openDrawer({ locationId, openingCents: cents });
                  if (!r.ok) return setError(r.error);
                  toast.success("Drawer open");
                  setOpen(false);
                }
                router.refresh();
              });
            }}>
              <div className="space-y-1"><Label htmlFor="drawer-cash">{drawer ? "Counted cash" : "Starting cash"}</Label><Input id="drawer-cash" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></div>
              {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>{drawer ? "Close drawer" : "Open drawer"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
