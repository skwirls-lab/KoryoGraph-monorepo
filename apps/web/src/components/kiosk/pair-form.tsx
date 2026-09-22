"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { pairKiosk } from "@/server/actions/kiosk";

export function PairForm({ locations }: { locations: { id: string; name: string }[] }) {
  const [v, setV] = useState({ locationId: locations[0]?.id ?? "", name: "Front desk tablet", confirm: "pin" as "pin" | "photo" });
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await pairKiosk(v); if (r && !r.ok) toast.error(r.error); }); }}>
      <div className="space-y-1">
        <Label htmlFor="k-loc">Location</Label>
        <select id="k-loc" value={v.locationId} onChange={(e) => setV({ ...v, locationId: e.target.value })} className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-fg">
          {locations.map((l) => <option key={l.id} value={l.id} className="bg-surface">{l.name}</option>)}
        </select>
      </div>
      <div className="space-y-1"><Label htmlFor="k-name">Device name</Label><Input id="k-name" className="h-11" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Families confirm check-in with</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="confirm" checked={v.confirm === "pin"} onChange={() => setV({ ...v, confirm: "pin" })} /> Their 4-digit family PIN (recommended)</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="confirm" checked={v.confirm === "photo"} onChange={() => setV({ ...v, confirm: "photo" })} /> Tapping their name and confirming (no PIN)</label>
      </fieldset>
      <p className="text-sm text-fg-secondary">Pairing signs you out on this device. It stays paired for a year or until revoked.</p>
      <Button type="submit" size="lg" disabled={pending || !v.locationId}>{pending ? "Pairing…" : "Pair this device"}</Button>
    </form>
  );
}
