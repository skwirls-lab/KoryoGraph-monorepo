"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { INTAKE_CONFIDENT, type IntakePayload } from "@/lib/intake";
import { decideApproval } from "@/server/actions/approvals";
import { uploadPackingSlip } from "@/server/actions/intake";

export function SlipUpload() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${pending ? "opacity-60" : ""}`}>
      <Upload aria-hidden className="size-4" /> {pending ? "Reading the slip…" : "Upload a packing slip"}
      <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" disabled={pending}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          start(async () => {
            const form = new FormData();
            form.set("file", f);
            const r = await uploadPackingSlip(form);
            if (r.ok) toast.success("Read the slip — check the lines below"); else toast.error(r.error);
            router.refresh();
          });
        }} />
    </label>
  );
}

export function IntakeEditor({ id, initial, variants, suppliers, fixture }: {
  id: string; initial: IntakePayload; variants: { id: string; label: string }[]; suppliers: { id: string; name: string }[]; fixture: boolean;
}) {
  const [p, setP] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const line = (i: number, patch: Partial<IntakePayload["lines"][number]>) => setP((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const units = p.lines.filter((l) => l.include && l.variant_id).reduce((a, l) => a + l.quantity, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor={`sup-${id}`}>Supplier</Label>
          <select id={`sup-${id}`} className={`${selectClass} w-64`} value={p.supplier_id ?? ""} onChange={(e) => setP({ ...p, supplier_id: e.target.value || null })}>
            <option value="" className="bg-surface">Choose…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.name}</option>)}
          </select></div>
        {p.supplier_text ? <span className="text-xs text-fg-muted">Slip says: “{p.supplier_text}”{p.reference ? ` · ref ${p.reference}` : ""}</span> : null}
        {fixture ? <Badge variant="secondary">dev fixture</Badge> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Lines read from the slip</caption>
          <thead className="text-left text-xs text-fg-muted"><tr><th className="p-2">Receive</th><th className="p-2">On the slip</th><th className="p-2">Qty</th><th className="p-2">Product</th><th className="p-2">Match</th></tr></thead>
          <tbody className="divide-y divide-default">
            {p.lines.map((l, i) => {
              const low = l.confidence < INTAKE_CONFIDENT;
              return (
                <tr key={i} aria-label={l.description} className={low ? "bg-warning/5" : ""}>
                  <td className="p-2"><input type="checkbox" className="size-5 accent-[var(--color-primary)]" aria-label={`Receive ${l.description}`} checked={l.include} disabled={!l.variant_id} onChange={(e) => line(i, { include: e.target.checked })} /></td>
                  <td className="p-2">{l.description}{l.sku_text ? <span className="block text-xs text-fg-muted">{l.sku_text}</span> : null}</td>
                  <td className="p-2"><Input aria-label={`Quantity for ${l.description}`} type="number" min={0} className="w-20" value={l.quantity} onChange={(e) => line(i, { quantity: Math.max(0, Number(e.target.value) || 0) })} /></td>
                  <td className="p-2">
                    <select aria-label={`Product for ${l.description}`} className={`${selectClass} w-64`} value={l.variant_id ?? ""}
                      onChange={(e) => line(i, { variant_id: e.target.value || null, variant_label: variants.find((v) => v.id === e.target.value)?.label ?? null, confidence: e.target.value ? 1 : 0, include: Boolean(e.target.value) })}>
                      <option value="" className="bg-surface">Not in the catalogue</option>
                      {variants.map((v) => <option key={v.id} value={v.id} className="bg-surface">{v.label}</option>)}
                    </select>
                  </td>
                  <td className="p-2">{l.variant_id ? <Badge variant={low ? "outline" : "secondary"}>{low ? "check · " : ""}{Math.round(l.confidence * 100)}%</Badge> : <Badge variant="outline">no match</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !p.supplier_id || units === 0} onClick={() => start(async () => {
          const r = await decideApproval({ id, decision: "approved", payload: p });
          if (!r.ok) { toast.error(r.error); return; }
          if (r.data.result && !r.data.result.ok) toast.error(r.data.result.error); else toast.success(r.data.result?.ok ? r.data.result.summary : "Received");
          router.refresh();
        })}>Receive {units} unit{units === 1 ? "" : "s"}</Button>
        <Button variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await decideApproval({ id, decision: "rejected", feedback: "Discarded on the receive page" }); if (!r.ok) toast.error(r.error); router.refresh(); })}>Discard</Button>
      </div>
    </div>
  );
}
