"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { WEEKDAYS, type ProgramInput } from "@/lib/validation/afterschool";
import { saveAfterschoolProgram } from "@/server/actions/afterschool";

export function ProgramDialog({ initial, billing }: { initial?: ProgramInput & { id: string }; billing: boolean }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ProgramInput>(initial ?? { name: "", weeklyPrice: "", schools: "", routes: "", days: [1, 2, 3, 4, 5], cutoff: "15:45" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const err = (k: string) => (errors[k] ? <p className="text-xs text-danger">{errors[k]}</p> : null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{initial ? <Button size="sm" variant="outline">Edit program</Button> : <Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New program</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit after-school program" : "New after-school program"}</DialogTitle>
          <DialogDescription>{billing ? "Families are billed weekly through the billing run." : "Billing isn't on for this school, so no weekly invoices are created."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await saveAfterschoolProgram(v);
            if (!r.ok) { setError(r.error); setErrors(r.fieldErrors ?? {}); return; }
            toast.success("Program saved");
            setOpen(false);
            router.refresh();
          });
        }}>
          <div className="space-y-1"><Label htmlFor="as-name">Name</Label><Input id="as-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />{err("name")}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="as-price">Weekly price</Label><Input id="as-price" inputMode="decimal" placeholder="95.00" value={v.weeklyPrice} onChange={(e) => setV({ ...v, weeklyPrice: e.target.value })} />{err("weeklyPrice")}</div>
            <div className="space-y-1"><Label htmlFor="as-cutoff">Pickup cutoff</Label><Input id="as-cutoff" type="time" value={v.cutoff} onChange={(e) => setV({ ...v, cutoff: e.target.value })} />{err("cutoff")}</div>
          </div>
          <div className="space-y-1"><Label htmlFor="as-schools">Schools (one per line)</Label><textarea id="as-schools" className={`${selectClass} h-20 py-2`} value={v.schools} onChange={(e) => setV({ ...v, schools: e.target.value })} />{err("schools")}</div>
          <div className="space-y-1"><Label htmlFor="as-routes">Pickup routes (one per line)</Label><textarea id="as-routes" className={`${selectClass} h-16 py-2`} value={v.routes ?? ""} onChange={(e) => setV({ ...v, routes: e.target.value })} /></div>
          <fieldset>
            <legend className="text-sm font-medium">Runs on</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((d) => (
                <label key={d.value} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" className="accent-[var(--color-primary)]" checked={v.days.includes(d.value)}
                    onChange={(e) => setV({ ...v, days: e.target.checked ? [...v.days, d.value].sort() : v.days.filter((x) => x !== d.value) })} />{d.short}
                </label>
              ))}
            </div>
            {err("days")}
          </fieldset>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save" : "Create program"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
