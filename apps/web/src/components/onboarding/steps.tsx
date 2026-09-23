"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createBrowserClient } from "@koryo/db/browser";
import { WEEKDAYS } from "@koryo/scheduling";
import { THEMES } from "@koryo/ui/components/theme/themes";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { PROGRAM_PRESETS } from "@/lib/program-presets";
import { dollars, price, quote, type Cycle, type PriceModule, type PricePlan } from "@/lib/pricing";
import { applyProgramPreset, goLive, inviteStaff, saveBranding, saveLocation, skipStep } from "@/server/actions/onboarding";
import { saveTemplate } from "@/server/actions/schedule";

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => start(async () => {
    setError(null);
    const r = await fn();
    if (r.ok) { toast.success(success); router.refresh(); } else setError(r.error);
  });
  return { pending, error, run };
}

const Err = ({ error }: { error: string | null }) => (error ? <p role="alert" className="text-sm text-danger">{error}</p> : null);

export function SkipStep({ step }: { step: string }) {
  const { pending, error, run } = useAction();
  return (
    <span className="inline-flex flex-col">
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => skipStep({ step }), "Skipped for now")}>Skip for now</Button>
      <Err error={error} />
    </span>
  );
}

export interface LocationValue { name: string; line1: string; line2: string; city: string; region: string; postalCode: string; country: string; phone: string }

export function LocationForm({ initial }: { initial: LocationValue }) {
  const [v, setV] = useState(initial);
  const { pending, error, run } = useAction();
  const field = (k: keyof LocationValue, label: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <div className="space-y-1"><Label htmlFor={`loc-${k}`}>{label}</Label><Input id={`loc-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} {...extra} /></div>
  );
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => saveLocation(v), "Location saved"); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Location name")}
        {field("phone", "Phone", { type: "tel", autoComplete: "tel" })}
        {field("line1", "Street address", { autoComplete: "address-line1" })}
        {field("line2", "Unit / suite (optional)", { autoComplete: "address-line2" })}
        {field("city", "City", { autoComplete: "address-level2" })}
        {field("region", "State / region", { autoComplete: "address-level1" })}
        {field("postalCode", "Postal code", { autoComplete: "postal-code" })}
        {field("country", "Country (2 letters)", { autoComplete: "country", maxLength: 2 })}
      </div>
      <Err error={error} />
      <Button type="submit" disabled={pending}>Save location</Button>
    </form>
  );
}

export function PresetPicker() {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Program presets">
        {PROGRAM_PRESETS.map((p) => (
          <li key={p.key} className="rounded-xl border border-default p-4">
            <h3 className="font-semibold">{p.name}</h3>
            <p className="text-sm text-fg-secondary">{p.description}</p>
            <ol className="my-3 flex flex-wrap gap-1" aria-label={`${p.name} ranks`}>
              {p.ranks.map((r) => <li key={r.name} title={r.name} className="h-3 w-6 rounded-sm border border-default" style={{ background: r.color }}><span className="sr-only">{r.name}</span></li>)}
            </ol>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => applyProgramPreset({ preset: p.key }), `${p.name} added with ${p.ranks.length} ranks`)}>Add {p.name}</Button>
          </li>
        ))}
      </ul>
      <Err error={error} />
    </div>
  );
}

const DAY_LABEL: Record<(typeof WEEKDAYS)[number], string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };

export function QuickClass({ programs, locationId, today }: { programs: { id: string; name: string }[]; locationId: string; today: string }) {
  const [v, setV] = useState({ name: "", programId: programs[0]?.id ?? "", days: ["MO", "WE"] as (typeof WEEKDAYS)[number][], time: "17:00", duration: "60", capacity: "20" });
  const { pending, error, run } = useAction();
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      run(async () => {
        const r = await saveTemplate({ name: v.name, locationId, programIds: v.programId ? [v.programId] : [], days: v.days, startTime: v.time, durationMin: Number(v.duration), startDate: today, capacity: v.capacity, instructorIds: [], bookable: true });
        if (r.ok) setV({ ...v, name: "" });
        return r;
      }, `${v.name} added to the schedule`);
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="qc-name">Class name</Label><Input id="qc-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Kids Beginners" /></div>
        <div className="space-y-1"><Label htmlFor="qc-program">Program</Label>
          <select id="qc-program" className={`${selectClass} h-9`} value={v.programId} onChange={(e) => setV({ ...v, programId: e.target.value })}>
            <option value="">No program</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <label key={d} className="flex items-center gap-1 rounded-md border border-default px-2 py-1 text-sm">
              <input type="checkbox" className="accent-[var(--color-primary)]" checked={v.days.includes(d)} onChange={(e) => setV({ ...v, days: e.target.checked ? [...v.days, d] : v.days.filter((x) => x !== d) })} />{DAY_LABEL[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="qc-time">Start time</Label><Input id="qc-time" type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="qc-dur">Minutes</Label><Input id="qc-dur" type="number" min={10} max={300} value={v.duration} onChange={(e) => setV({ ...v, duration: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="qc-cap">Capacity</Label><Input id="qc-cap" type="number" min={1} max={500} value={v.capacity} onChange={(e) => setV({ ...v, capacity: e.target.value })} /></div>
      </div>
      <Err error={error} />
      <Button type="submit" disabled={pending || !v.name.trim()}>Add class</Button>
    </form>
  );
}

const ROLES = [["front_desk", "Front desk"], ["instructor", "Instructor"], ["assistant_instructor", "Assistant instructor"], ["admin", "Admin"]] as const;

export function InviteForm() {
  const [v, setV] = useState({ name: "", email: "", roleKey: "instructor" as (typeof ROLES)[number][0] });
  const { pending, error, run } = useAction();
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_1fr_12rem_auto] sm:items-end" onSubmit={(e) => {
      e.preventDefault();
      run(async () => { const r = await inviteStaff(v); if (r.ok) setV({ ...v, name: "", email: "" }); return r; }, `Invitation sent to ${v.email}`);
    }}>
      <div className="space-y-1"><Label htmlFor="inv-name">Name</Label><Input id="inv-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="inv-email">Email</Label><Input id="inv-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="inv-role">Role</Label>
        <select id="inv-role" className={`${selectClass} h-9`} value={v.roleKey} onChange={(e) => setV({ ...v, roleKey: e.target.value as typeof v.roleKey })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <Button type="submit" disabled={pending}>Send invitation</Button>
      <div className="sm:col-span-4"><Err error={error} /></div>
    </form>
  );
}

const THEME_LABEL: Record<(typeof THEMES)[number], string> = { "koryo-red": "Koryo red (dark)", dark: "Dark", light: "Light", midnight: "Midnight", warm: "Warm" };

export function BrandingForm({ tenantId, theme, logoPath, logoUrl }: { tenantId: string; theme: string | null; logoPath: string | null; logoUrl: string | null }) {
  const [t, setT] = useState(theme ?? "koryo-red");
  const [path, setPath] = useState(logoPath);
  const [preview, setPreview] = useState(logoUrl);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { pending, error, run } = useAction();
  const upload = async (f: File) => {
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(f.type) || f.size > 2 * 1024 * 1024) { toast.error("Use a PNG, JPEG, WebP or SVG up to 2 MB."); return; }
    setUploading(true);
    const p = `${tenantId}/branding/logo-${crypto.randomUUID()}.${f.type === "image/svg+xml" ? "svg" : f.type.split("/")[1]}`;
    const { error: e } = await createBrowserClient().storage.from("tenant-media").upload(p, f, { contentType: f.type });
    setUploading(false);
    if (e) { toast.error("The upload didn't go through."); return; }
    setPath(p);
    setPreview(URL.createObjectURL(f));
  };
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); run(() => saveBranding({ theme: t, logoPath: path }), "Branding saved"); }}>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Look for your staff apps</legend>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((x) => (
            <label key={x} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${t === x ? "border-primary" : "border-default"}`}>
              <input type="radio" name="theme" value={x} checked={t === x} onChange={() => setT(x)} className="sr-only" />{THEME_LABEL[x]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-fg-muted">Each person can still choose their own; the family app stays light by default.</p>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        {/* Local preview or a signed storage URL; next/image would proxy and cache it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="Your logo" className="size-16 rounded-lg border border-default object-contain" /> : <div className="grid size-16 place-items-center rounded-lg border border-dashed border-default text-xs text-fg-muted">No logo</div>}
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label="Logo file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => file.current?.click()}>{uploading ? "Uploading…" : path ? "Replace logo" : "Upload logo"}</Button>
        {path ? <Button type="button" variant="ghost" size="sm" onClick={() => { setPath(null); setPreview(null); }}>Remove</Button> : null}
      </div>
      <Err error={error} />
      <Button type="submit" disabled={pending || uploading}>Save branding</Button>
    </form>
  );
}

export function GoLive({ plans, modules, planChoice, stripeConnected }: { plans: PricePlan[]; modules: PriceModule[]; planChoice: string | null; stripeConnected: boolean }) {
  const [plan, setPlan] = useState<string>(plans.some((p) => p.key === planChoice) ? (planChoice as string) : planChoice === "custom" ? "custom" : "academy_ai");
  const [custom, setCustom] = useState<string[]>(["billing", "home"]);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const chosen = plans.find((p) => p.key === plan);
  const q = quote(modules, plans, plan === "custom" ? custom : chosen?.modules ?? [], cycle);
  const total = chosen ? price(chosen, cycle) : q.totalCents;
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Plan</legend>
        {[...plans.map((p) => ({ key: p.key, name: p.name, text: `${dollars(price(p, cycle))}/${cycle === "monthly" ? "month" : "year"} · ${p.description}` })), { key: "custom", name: "Custom", text: "Pick modules one by one" }].map((o) => (
          <label key={o.key} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${plan === o.key ? "border-primary" : "border-default"}`}>
            <input type="radio" name="plan" value={o.key} checked={plan === o.key} onChange={() => setPlan(o.key)} className="mt-1 accent-[var(--color-primary)]" />
            <span><span className="font-medium">{o.name}</span><span className="block text-sm text-fg-secondary">{o.text}</span></span>
          </label>
        ))}
      </fieldset>
      {plan === "custom" ? (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium">Modules</legend>
          {modules.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--color-primary)]" disabled={m.required} checked={m.required || custom.includes(m.key)} onChange={(e) => setCustom((c) => (e.target.checked ? [...c, m.key] : c.filter((x) => x !== m.key)))} />
              {m.name} <span className="text-fg-muted">{dollars(price(m, cycle))}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <fieldset className="flex gap-4 text-sm">
        <legend className="sr-only">Billing cycle</legend>
        {(["monthly", "annual"] as const).map((c) => <label key={c} className="flex items-center gap-2"><input type="radio" name="cycle" checked={cycle === c} onChange={() => setCycle(c)} className="accent-[var(--color-primary)]" />{c === "monthly" ? "Monthly" : "Annual (2 months free)"}</label>)}
      </fieldset>
      <p className="text-lg">Total: <strong className="tabular">{dollars(total)}</strong>/{cycle === "monthly" ? "month" : "year"}</p>
      <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">Billing for your KoryoGraph subscription isn&apos;t connected in this build: going live switches your modules to this plan and ends the trial, but nothing is charged.{!stripeConnected ? " You haven't connected Stripe yet, so you can't take card payments from families until you do." : ""}</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="accent-[var(--color-primary)]" /> Modules outside this plan will be switched off when the trial ends now.</label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button disabled={!confirm || pending} onClick={() => start(async () => {
        setError(null);
        const r = await goLive({ plan: plan === "custom" ? null : plan, modules: plan === "custom" ? custom : [], cycle });
        if (!r.ok) { setError(r.error); return; }
        toast.success("You're live!");
        router.push("/desk");
        router.refresh();
      })}>Go live</Button>
    </div>
  );
}
