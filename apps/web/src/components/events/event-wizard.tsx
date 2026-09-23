"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { EVENT_KINDS, PRICE_PER, eventDates, type EventInput, type EventKind } from "@/lib/validation/events";
import { saveEvent } from "@/server/actions/events";

const STEPS = ["Kind", "Dates", "Pricing", "Capacity & waivers", "Review"] as const;
type Option = { label: string; price: string; per: "person" | "day" | "week" };

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p id={`${id}-err`} className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

/** Kind → dates → pricing → capacity & waivers → review. Editing opens on the review step with every field reachable. */
export function EventWizard({ initial, waivers, households }: {
  initial?: EventInput & { id: string };
  waivers: { id: string; name: string }[];
  households: { id: string; name: string }[];
}) {
  const [v, setV] = useState<EventInput>(initial ?? {
    kind: "camp", name: "", description: "", startDate: "", endDate: "", startTime: "09:00", endTime: "15:00", weekdaysOnly: true,
    pricing: [{ label: "Full week", price: "", per: "person" }, { label: "Single day", price: "", per: "day" }], capacity: "", waiverIds: [], closesDate: "", hostHouseholdId: "", deposit: "",
  });
  const [step, setStep] = useState(initial ? STEPS.length - 1 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<EventInput>) => setV((x) => ({ ...x, ...patch }));
  const pricing = (v.pricing ?? []) as Option[];
  const setPricing = (p: Option[]) => set({ pricing: p });
  const days = v.startDate && v.endDate && v.endDate > v.startDate ? eventDates(v.startDate, v.endDate, v.weekdaysOnly ?? true) : [];
  const kind = v.kind as EventKind;

  const submit = () => {
    setError(null);
    setErrors({});
    start(async () => {
      const r = await saveEvent(v);
      if (!r.ok) {
        setError(r.error);
        setErrors(r.fieldErrors ?? {});
        return;
      }
      toast.success("Event saved");
      router.refresh();
    });
  };
  const next = () => {
    if (step === 1 && (!v.startDate || !v.endDate)) return setErrors({ startDate: v.startDate ? "" : "Pick a date", endDate: v.endDate ? "" : "Pick a date" });
    if (step === 0 && v.name.trim().length < 2) return setErrors({ name: "Name the event" });
    setErrors({});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}
              className={`rounded-full border px-3 py-1 ${i === step ? "border-primary bg-primary/10 font-semibold" : "border-default text-fg-secondary"}`}>{i + 1}. {s}</button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <fieldset className="space-y-3">
          <legend className="sr-only">Kind</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Kind">
            {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => (
              <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${kind === k ? "border-primary bg-primary/5" : "border-default"}`}>
                <input type="radio" name="kind" className="accent-[var(--color-primary)]" checked={kind === k}
                  onChange={() => set({ kind: k, ...(k === "party" && !initial ? { pricing: [], weekdaysOnly: false } : {}) })} /> {EVENT_KINDS[k]}
              </label>
            ))}
          </div>
          <Field id="ev-name" label="Name" error={errors.name}>
            <Input id="ev-name" value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder={kind === "party" ? "Maya's 8th birthday" : "Summer camp — week 1"} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field id="ev-desc" label="Description">
            <textarea id="ev-desc" className={`${selectClass} h-24 py-2`} value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="space-y-3">
          <legend className="sr-only">Dates</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ev-start" label="First day" error={errors.startDate}><Input id="ev-start" type="date" value={v.startDate} onChange={(e) => set({ startDate: e.target.value, ...(!v.endDate || v.endDate < e.target.value ? { endDate: e.target.value } : {}) })} /></Field>
            <Field id="ev-end" label="Last day" error={errors.endDate}><Input id="ev-end" type="date" value={v.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
            <Field id="ev-st" label="Starts" error={errors.startTime}><Input id="ev-st" type="time" value={v.startTime} onChange={(e) => set({ startTime: e.target.value })} /></Field>
            <Field id="ev-et" label="Ends" error={errors.endTime}><Input id="ev-et" type="time" value={v.endTime} onChange={(e) => set({ endTime: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--color-primary)]" checked={v.weekdaysOnly ?? true} onChange={(e) => set({ weekdaysOnly: e.target.checked })} /> Weekdays only</label>
          <p className="text-sm text-fg-secondary" role="status">{days.length ? `${days.length} days — families can choose days, and capacity counts per day.` : "A single-day event."}</p>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">{kind === "party" ? "Pricing (optional — parties usually take a deposit instead)" : "Price options"}</legend>
          {pricing.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <Field id={`opt-${i}-label`} label="Option"><Input id={`opt-${i}-label`} className="w-48" value={p.label} onChange={(e) => setPricing(pricing.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></Field>
              <Field id={`opt-${i}-price`} label="Price" error={errors[`pricing.${i}.price`]}><Input id={`opt-${i}-price`} className="w-28" inputMode="decimal" placeholder="0.00" value={p.price} onChange={(e) => setPricing(pricing.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} /></Field>
              <Field id={`opt-${i}-per`} label="Charged">
                <select id={`opt-${i}-per`} className={`${selectClass} w-36`} value={p.per} onChange={(e) => setPricing(pricing.map((x, j) => (j === i ? { ...x, per: e.target.value as Option["per"] } : x)))}>
                  {Object.entries(PRICE_PER).map(([k, l]) => <option key={k} value={k} className="bg-surface">{l}</option>)}
                </select>
              </Field>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove option ${i + 1}`} onClick={() => setPricing(pricing.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          {errors.pricing ? <p className="text-xs text-danger">{errors.pricing}</p> : null}
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setPricing([...pricing, { label: "", price: "", per: "person" }])}><Plus className="size-4" /> Add option</Button>
          {kind === "party" ? (
            <div className="grid gap-3 border-t border-default pt-3 sm:grid-cols-2">
              <Field id="ev-host" label="Host family">
                <select id="ev-host" className={selectClass} value={v.hostHouseholdId ?? ""} onChange={(e) => set({ hostHouseholdId: e.target.value })}>
                  <option value="" className="bg-surface">Choose…</option>
                  {households.map((h) => <option key={h.id} value={h.id} className="bg-surface">{h.name}</option>)}
                </select>
              </Field>
              <Field id="ev-deposit" label="Deposit" error={errors.deposit}><Input id="ev-deposit" inputMode="decimal" placeholder="100.00" value={v.deposit ?? ""} onChange={(e) => set({ deposit: e.target.value })} /></Field>
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {step === 3 ? (
        <fieldset className="space-y-3">
          <legend className="sr-only">Capacity and waivers</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ev-cap" label={days.length ? "Capacity per day" : "Capacity"} error={errors.capacity}>
              <Input id="ev-cap" type="number" min={1} value={v.capacity === undefined || v.capacity === "" ? "" : String(v.capacity)} onChange={(e) => set({ capacity: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="No limit" />
            </Field>
            <Field id="ev-close" label="Registration closes"><Input id="ev-close" type="date" value={v.closesDate ?? ""} onChange={(e) => set({ closesDate: e.target.value })} /></Field>
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Required waivers</legend>
            {!waivers.length ? <p className="text-sm text-fg-muted">No waivers published yet (Documents).</p> : waivers.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--color-primary)]" checked={(v.waiverIds ?? []).includes(w.id)}
                  onChange={(e) => set({ waiverIds: e.target.checked ? [...(v.waiverIds ?? []), w.id] : (v.waiverIds ?? []).filter((x) => x !== w.id) })} /> {w.name}
              </label>
            ))}
            <p className="text-xs text-fg-muted">Families sign these before registering{kind === "party" ? "; party guests sign through the guest link" : ""}.</p>
          </fieldset>
        </fieldset>
      ) : null}

      {step === 4 ? (
        <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-default p-4 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-fg-muted">Kind</dt><dd>{EVENT_KINDS[kind]}</dd>
          <dt className="text-fg-muted">Name</dt><dd>{v.name || "—"}</dd>
          <dt className="text-fg-muted">When</dt><dd>{v.startDate || "—"}{v.endDate && v.endDate !== v.startDate ? ` → ${v.endDate} (${days.length} days)` : ""}, {v.startTime}–{v.endTime}</dd>
          <dt className="text-fg-muted">Pricing</dt><dd>{pricing.length ? pricing.map((p) => `${p.label} $${p.price || "0"} ${PRICE_PER[p.per]}`).join(" · ") : "Free"}</dd>
          <dt className="text-fg-muted">Capacity</dt><dd>{v.capacity === "" || v.capacity === undefined ? "No limit" : `${v.capacity}${days.length ? " per day" : ""}`}</dd>
          <dt className="text-fg-muted">Waivers</dt><dd>{(v.waiverIds ?? []).map((id) => waivers.find((w) => w.id === id)?.name).filter(Boolean).join(", ") || "None"}</dd>
          {kind === "party" ? <><dt className="text-fg-muted">Host</dt><dd>{households.find((h) => h.id === v.hostHouseholdId)?.name ?? "—"}{v.deposit ? ` · deposit $${v.deposit}` : ""}</dd></> : null}
        </dl>
      ) : null}

      {error ? <p role="alert" className="text-sm text-danger">{error}{Object.values(errors).filter(Boolean).length ? `: ${Object.values(errors).filter(Boolean).join("; ")}` : ""}</p> : null}
      <div className="flex gap-2">
        {step > 0 ? <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Back</Button> : null}
        {step < STEPS.length - 1 ? <Button type="button" onClick={next}>Next</Button>
          : <Button type="button" disabled={pending} onClick={submit}>{pending ? "Saving…" : initial ? "Save event" : "Create event"}</Button>}
      </div>
    </div>
  );
}
