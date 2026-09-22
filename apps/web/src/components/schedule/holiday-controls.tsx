"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { addHoliday, deleteHoliday } from "@/server/actions/schedule";

export function AddHolidayForm() {
  const [v, setV] = useState({ date: "", name: "" });
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addHoliday(v); if (r.ok) { toast.success("Holiday added — its classes are removed"); setV({ date: "", name: "" }); } else toast.error(r.error); }); }}>
      <div className="space-y-1"><Label htmlFor="hd-date">Date</Label><Input id="hd-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></div>
      <div className="min-w-48 flex-1 space-y-1"><Label htmlFor="hd-name">Name</Label><Input id="hd-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Thanksgiving" /></div>
      <Button type="submit" disabled={pending || !v.date || v.name.trim().length < 2}>Add holiday</Button>
    </form>
  );
}

export function DeleteHolidayButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="icon" aria-label={`Remove ${name}`} disabled={pending} onClick={() => start(async () => { const r = await deleteHoliday({ id }); if (r.ok) toast.success("Holiday removed"); else toast.error(r.error); })}>
      <Trash2 className="size-4" />
    </Button>
  );
}
