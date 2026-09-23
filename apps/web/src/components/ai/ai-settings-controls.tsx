"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { setAiBudget, setBillingRecoveryMode, testAiConnection } from "@/server/actions/ai-settings";

export function TestConnection() {
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
        const r = await testAiConnection();
        if (!r.ok) setResult({ tone: "error", text: r.error });
        else if (r.data.fixture) setResult({ tone: "warn", text: `Answered from a recorded dev fixture — no live call was made (echo "${r.data.echo}").` });
        else setResult({ tone: "ok", text: `Connected: ${r.data.model} answered "${r.data.echo}" (${r.data.costCents.toFixed(4)}¢).` });
        router.refresh();
      })}>{pending ? "Testing…" : "Test connection"}</Button>
      {result ? <p role="status" className={`text-sm ${result.tone === "ok" ? "text-success" : result.tone === "warn" ? "text-warning" : "text-danger"}`}>{result.text}</p> : null}
    </div>
  );
}

export function BudgetForm({ monthly }: { monthly: string }) {
  const [v, setV] = useState(monthly);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => { const r = await setAiBudget({ monthly: v }); if (r.ok) { toast.success("Budget saved"); router.refresh(); } else setError(r.error); });
    }}>
      <div className="space-y-1"><Label htmlFor="ai-budget">Monthly AI budget ($)</Label><Input id="ai-budget" className="w-32" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} /></div>
      <Button type="submit" size="sm" disabled={pending}>Save</Button>
      {error ? <p role="alert" className="w-full text-sm text-danger">{error}</p> : null}
    </form>
  );
}

export function BillingRecoveryMode({ mode }: { mode: string }) {
  const [v, setV] = useState(mode);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-1">
      <Label htmlFor="ai-billing-recovery">Failed-payment follow-ups</Label>
      <select id="ai-billing-recovery" className="block h-9 rounded-md border border-default bg-surface px-2 text-sm" value={v} disabled={pending} onChange={(e) => {
        const next = e.target.value;
        const prev = v;
        setV(next);
        start(async () => { const r = await setBillingRecoveryMode({ mode: next }); if (r.ok) { toast.success("Saved"); router.refresh(); } else { setV(prev); toast.error(r.error); } });
      }}>
        <option value="off">Off — standard reminder templates</option>
        <option value="approve">Draft, staff approve each one</option>
        <option value="auto">Draft and send (after the first approval)</option>
      </select>
    </div>
  );
}
