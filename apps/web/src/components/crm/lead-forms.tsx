"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form } from "@koryo/ui/components/ui/form";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { FormError } from "@/components/forms/form-error";
import { MultiCheckField, SelectField, selectClass } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { newLeadSchema } from "@/lib/validation/crm";
import { addLeadActivity, convertLead, createLead, saveStage, setNextAction } from "@/server/actions/crm";

export function NewLeadDialog({ programs }: { programs: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { form, pending, submit } = useActionForm({
    schema: newLeadSchema,
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", programIds: [], source: "walk_in", note: "" },
    action: createLead,
    onSuccess: (d) => { toast.success(d.merged ? "Matched an existing lead — note added" : "Lead added"); setOpen(false); form.reset(); router.refresh(); },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New lead</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField form={form} name="firstName" label="First name" />
              <TextField form={form} name="lastName" label="Last name" />
              <TextField form={form} name="email" label="Email" type="email" />
              <TextField form={form} name="phone" label="Phone" type="tel" />
            </div>
            <SelectField form={form} name="source" label="Source" options={[
              { value: "walk_in", label: "Walk-in" }, { value: "phone", label: "Phone call" }, { value: "referral", label: "Referral" },
              { value: "event", label: "Event / demo" }, { value: "website", label: "Website" }, { value: "social", label: "Social media" },
            ]} />
            <MultiCheckField form={form} name="programIds" legend="Interested in" options={programs} />
            <TextField form={form} name="note" label="Note" />
            <FormError form={form} />
            <Button type="submit" disabled={pending}>Add lead</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const [kind, setKind] = useState<"note" | "call" | "email" | "sms">("note");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await addLeadActivity({ leadId, kind, body });
        if (r.ok) { setBody(""); router.refresh(); } else toast.error(r.error);
      });
    }}>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="act-kind">Kind</label>
        <select id="act-kind" className={`${selectClass} w-32`} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="note" className="bg-surface">Note</option><option value="call" className="bg-surface">Call</option>
          <option value="email" className="bg-surface">Email</option><option value="sms" className="bg-surface">Text</option>
        </select>
        <Button type="submit" size="sm" disabled={pending || body.trim().length < 2}>Log</Button>
      </div>
      <Textarea aria-label="What happened" value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Called, left a voicemail…" />
    </form>
  );
}

export function NextActionForm({ leadId, text, at }: { leadId: string; text: string; at: string }) {
  const [t, setT] = useState(text);
  const [d, setD] = useState(at);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await setNextAction({ leadId, text: t, at: d }); if (r.ok) toast.success("Next action saved (and added to Tasks)"); else toast.error(r.error); router.refresh(); });
    }}>
      <div className="space-y-1"><Label htmlFor="na-text">Next action</Label><Input id="na-text" value={t} onChange={(e) => setT(e.target.value)} placeholder="Call after the trial" /></div>
      <div className="space-y-1"><Label htmlFor="na-at">Due</Label><Input id="na-at" type="date" value={d} onChange={(e) => setD(e.target.value)} /></div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>Save</Button>
    </form>
  );
}

export function ConvertButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button disabled={pending} onClick={() => start(async () => {
      const r = await convertLead(leadId);
      if (r.ok) router.push(r.data.url);
      else toast.error(r.error);
    })}>Convert to member</Button>
  );
}

export function StageRow({ id, name, position }: { id?: string; name: string; position: number }) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(String(position));
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveStage({ id, name: n, position: Number(p) }); if (r.ok) { toast.success("Saved"); if (!id) setN(""); } else toast.error(r.error); router.refresh(); }); }}>
      <Input aria-label={id ? `Stage name (${name})` : "New stage name"} value={n} onChange={(e) => setN(e.target.value)} placeholder="New stage" />
      <Input aria-label={id ? `Order (${name})` : "New stage order"} value={p} onChange={(e) => setP(e.target.value)} className="w-20" inputMode="numeric" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{id ? "Save" : "Add"}</Button>
    </form>
  );
}
