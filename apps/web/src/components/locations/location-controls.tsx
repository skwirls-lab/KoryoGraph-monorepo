"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { addLocation, setCurrentLocation, setStaffLocations } from "@/server/actions/locations";

export function LocationSwitcher({ locations, selected }: { locations: { id: string; name: string }[]; selected: string | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">Location</span>
      <select aria-label="Location" className="h-8 max-w-40 rounded-md border border-default bg-surface px-2 text-sm" value={selected ?? ""} disabled={pending}
        onChange={(e) => start(async () => { await setCurrentLocation({ id: e.target.value || null }); router.refresh(); })}>
        <option value="">All locations</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </label>
  );
}

export function AddLocation() {
  const [v, setV] = useState({ name: "", line1: "", city: "", region: "", postalCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const f = (k: keyof typeof v, label: string) => <div className="space-y-1"><Label htmlFor={`nl-${k}`}>{label}</Label><Input id={`nl-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { setError(null); const r = await addLocation(v); if (r.ok) { toast.success(`${v.name} added`); setV({ name: "", line1: "", city: "", region: "", postalCode: "" }); router.refresh(); } else setError(r.error); }); }}>
      <div className="grid gap-3 sm:grid-cols-2">{f("name", "New location name")}{f("line1", "Street address")}{f("city", "City")}{f("region", "State / region")}{f("postalCode", "Postal code")}</div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending}>Add location</Button>
    </form>
  );
}

export function StaffLocations({ userId, locations, current }: { userId: string; locations: { id: string; name: string }[]; current: string[] }) {
  const [sel, setSel] = useState<string[]>(current);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setStaffLocations({ userId, locationIds: sel }); if (r.ok) { toast.success("Locations saved"); router.refresh(); } else toast.error(r.error); }); }}>
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="mb-1 text-sm font-medium">Works at</legend>
        {locations.map((l) => <label key={l.id} className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--color-primary)]" checked={sel.includes(l.id)} onChange={(e) => setSel(e.target.checked ? [...sel, l.id] : sel.filter((x) => x !== l.id))} />{l.name}</label>)}
      </fieldset>
      <p className="text-xs text-fg-muted">{sel.length ? "They'll only see classes, sales and stock at these locations." : "No locations ticked: they see every location."}</p>
      <Button size="sm" type="submit" disabled={pending}>Save locations</Button>
    </form>
  );
}
