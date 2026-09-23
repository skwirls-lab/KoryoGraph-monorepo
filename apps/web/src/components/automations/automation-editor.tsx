"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { Switch } from "@koryo/ui/components/ui/switch";
import { selectClass } from "@/components/forms/select-field";
import { ACTION_LABELS, SCHEDULED, TRIGGER_KINDS, type AutomationAction, type AutomationInput, type Condition, type TriggerKind } from "@/lib/automations";
import { saveAutomation, setAutomationActive } from "@/server/actions/automations";

const STATUSES = ["active", "trial", "on_hold", "lead", "cancelled", "alumni"];

export function AutomationEditor({ initial, templates, programs, stages }: {
  initial: AutomationInput;
  templates: { key: string; description: string }[];
  programs: { id: string; name: string }[];
  stages: { key: string; name: string }[];
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const kind = v.trigger.kind as TriggerKind;
  const conditions = (v.conditions ?? []) as Condition[];
  const actions = v.actions as AutomationAction[];
  const setActions = (a: AutomationAction[]) => setV({ ...v, actions: a });
  const setConditions = (c: Condition[]) => setV({ ...v, conditions: c });
  const patchAction = (i: number, patch: Partial<AutomationAction>) => setActions(actions.map((a, j) => (j === i ? ({ ...a, ...patch } as AutomationAction) : a)));
  const move = (i: number, d: -1 | 1) => { const a = [...actions]; const [x] = a.splice(i, 1); if (x) a.splice(i + d, 0, x); setActions(a); };
  const add = (type: AutomationAction["type"]) => setActions([...actions, (
    type === "send" ? { type, template_key: templates[0]?.key ?? "welcome", channels: ["email"] }
      : type === "wait" ? { type, days: 1 }
        : type === "create_task" ? { type, title: "Follow up with {{student_name}}", due_days: 1 }
          : type === "notify_staff" ? { type, title: "{{student_name}} needs attention" }
            : { type, tag: "follow-up" }) as AutomationAction]);

  return (
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await saveAutomation(v);
        if (!r.ok) { setError(r.error); return; }
        toast.success("Automation saved");
        if (!v.id) router.push(`/desk/automations/${r.data.id}`); else router.refresh();
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1"><Label htmlFor="a-name">Name</Label><Input id="a-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={Boolean(v.active)} onCheckedChange={(on) => setV({ ...v, active: on })} aria-label="Active" /> Active</label>
      </div>
      <div className="space-y-1"><Label htmlFor="a-desc">Description</Label><Input id="a-desc" value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>

      <fieldset className="space-y-2 rounded-lg border border-default p-3">
        <legend className="px-1 text-sm font-semibold">When</legend>
        <select aria-label="Trigger" className={selectClass} value={kind} onChange={(e) => setV({ ...v, trigger: { kind: e.target.value as TriggerKind, params: {} } })}>
          {Object.entries(TRIGGER_KINDS).map(([k, label]) => <option key={k} value={k} className="bg-surface">{label}</option>)}
        </select>
        {SCHEDULED.includes(kind) && kind !== "birthday" ? (
          <div className="flex items-center gap-2 text-sm"><Label htmlFor="a-days">Days</Label>
            <Input id="a-days" type="number" min={1} max={365} className="w-24" value={v.trigger.params?.days ?? 14} onChange={(e) => setV({ ...v, trigger: { kind, params: { days: Number(e.target.value) } } })} /></div>
        ) : null}
        {kind === "lead.stage_changed" ? (
          <select aria-label="Stage" className={selectClass} value={v.trigger.params?.stage ?? ""} onChange={(e) => setV({ ...v, trigger: { kind, params: { stage: e.target.value } } })}>
            {stages.map((s) => <option key={s.key} value={s.key} className="bg-surface">{s.name}</option>)}
          </select>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2 rounded-lg border border-default p-3">
        <legend className="px-1 text-sm font-semibold">Only if</legend>
        {!conditions.length ? <p className="text-sm text-fg-muted">Everyone matching the trigger.</p> : null}
        {conditions.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium capitalize">{c.field}</span>
            {c.field === "status" ? STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--color-primary)]" checked={c.value.includes(s)}
                onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...c, value: e.target.checked ? [...c.value, s] : c.value.filter((y) => y !== s) } : x)))} />{s.replace("_", " ")}</label>
            )) : null}
            {c.field === "program" ? programs.map((p) => (
              <label key={p.id} className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--color-primary)]" checked={c.value.includes(p.id)}
                onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...c, value: e.target.checked ? [...c.value, p.id] : c.value.filter((y) => y !== p.id) } : x)))} />{p.name}</label>
            )) : null}
            {c.field === "tag" ? (
              <>
                <select aria-label="Tag rule" className={`${selectClass} w-32`} value={c.op} onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...c, op: e.target.value as "has" | "not_has" } : x)))}>
                  <option value="has" className="bg-surface">has</option><option value="not_has" className="bg-surface">doesn&apos;t have</option>
                </select>
                <Input aria-label="Tag" className="w-40" value={c.value} onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...c, value: e.target.value } : x)))} />
              </>
            ) : null}
            {c.field === "consent" ? (
              <select aria-label="Consent channel" className={`${selectClass} w-32`} value={c.value} onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...c, value: e.target.value as "email" | "sms" } : x)))}>
                <option value="email" className="bg-surface">email</option><option value="sms" className="bg-surface">SMS</option>
              </select>
            ) : null}
            <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${c.field} condition`} onClick={() => setConditions(conditions.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => setConditions([...conditions, { field: "status", op: "in", value: ["active"] }])}>+ Status</Button>
          {programs.length ? <Button type="button" size="sm" variant="outline" onClick={() => setConditions([...conditions, { field: "program", op: "in", value: [programs[0]?.id ?? ""] }])}>+ Program</Button> : null}
          <Button type="button" size="sm" variant="outline" onClick={() => setConditions([...conditions, { field: "tag", op: "has", value: "" }])}>+ Tag</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConditions([...conditions, { field: "consent", op: "has", value: "email" }])}>+ Consent</Button>
        </div>
      </fieldset>

      <fieldset className="space-y-2 rounded-lg border border-default p-3">
        <legend className="px-1 text-sm font-semibold">Then</legend>
        <ol className="space-y-2">
          {actions.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-elevated p-2 text-sm">
              <span className="w-6 text-center text-fg-muted">{i + 1}.</span>
              <span className="font-medium">{ACTION_LABELS[a.type]}</span>
              {a.type === "send" ? (
                <>
                  <select aria-label={`Template for step ${i + 1}`} className={`${selectClass} w-60`} value={a.template_key} onChange={(e) => patchAction(i, { template_key: e.target.value })}>
                    {templates.map((t) => <option key={t.key} value={t.key} className="bg-surface">{t.description}</option>)}
                  </select>
                  {(["email", "sms"] as const).map((ch) => (
                    <label key={ch} className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--color-primary)]" checked={a.channels.includes(ch)}
                      onChange={(e) => patchAction(i, { channels: e.target.checked ? [...a.channels, ch] : a.channels.filter((x) => x !== ch) })} />{ch}</label>
                  ))}
                </>
              ) : null}
              {a.type === "wait" ? <><Input aria-label={`Days to wait at step ${i + 1}`} type="number" min={1} className="w-20" value={a.days} onChange={(e) => patchAction(i, { days: Number(e.target.value) })} /> days</> : null}
              {a.type === "create_task" || a.type === "notify_staff" ? <Input aria-label={`Title for step ${i + 1}`} className="min-w-60 flex-1" value={a.title} onChange={(e) => patchAction(i, { title: e.target.value })} /> : null}
              {a.type === "create_task" ? <>due in <Input aria-label={`Due days for step ${i + 1}`} type="number" min={0} className="w-16" value={a.due_days} onChange={(e) => patchAction(i, { due_days: Number(e.target.value) })} /> days</> : null}
              {a.type === "add_tag" ? <Input aria-label={`Tag for step ${i + 1}`} className="w-40" value={a.tag} onChange={(e) => patchAction(i, { tag: e.target.value })} /> : null}
              <span className="ml-auto flex">
                <Button type="button" size="sm" variant="ghost" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                <Button type="button" size="sm" variant="ghost" disabled={i === actions.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove step ${i + 1}`} onClick={() => setActions(actions.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(ACTION_LABELS) as AutomationAction["type"][]).map((t) => <Button key={t} type="button" size="sm" variant="outline" onClick={() => add(t)}>+ {ACTION_LABELS[t]}</Button>)}
        </div>
        <p className="text-xs text-fg-muted">Task titles can use {"{{student_name}}"}. Messages go through the Outbox: consent and quiet hours apply.</p>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save automation"}</Button>
    </form>
  );
}

export function AutomationToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Switch checked={active} disabled={pending} aria-label={`${name} active`}
      onCheckedChange={(on) => start(async () => { const r = await setAutomationActive({ id, active: on }); if (r.ok) toast.success(on ? `${name} is on` : `${name} is off`); else toast.error(r.error); router.refresh(); })} />
  );
}
