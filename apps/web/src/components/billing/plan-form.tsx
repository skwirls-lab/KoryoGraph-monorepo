"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form } from "@koryo/ui/components/ui/form";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormError } from "@/components/forms/form-error";
import { MultiCheckField, SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { PLAN_KIND_LABELS, PLAN_KINDS, planSchema, type PlanInput } from "@/lib/validation/billing";
import { savePlan } from "@/server/actions/billing";

export interface PlanFormOptions {
  programs: { value: string; label: string }[];
  products: { value: string; label: string }[];
  taxClasses: { value: string; label: string }[];
  retail: boolean;
}

export const EMPTY_PLAN: PlanInput = {
  name: "", description: "", kind: "recurring", interval: "month", intervalCount: 1, price: "", enrollmentFee: "", contractMonths: "",
  earlyTerminationFee: "", autoRenew: true, termMonths: "", classPackSize: "", trialDays: "", programIds: [], unlimited: true,
  classesPerWeek: "", secondPct: 0, thirdPlusPct: 0, taxClass: "exempt", gearProductIds: [], isPublic: false, active: true,
};

function PlanFields({ initial, options, onDone }: { initial: PlanInput; options: PlanFormOptions; onDone: () => void }) {
  const { form, pending, submit } = useActionForm({
    schema: planSchema,
    defaultValues: initial,
    action: savePlan,
    onSuccess: () => { toast.success("Plan saved"); onDone(); },
  });
  const kind = form.watch("kind");
  const unlimited = form.watch("unlimited");
  const recurring = kind === "recurring" || kind === "contract";
  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField form={form} name="name" label="Plan name" placeholder="Monthly Unlimited" />
        <TextField form={form} name="description" label="Description" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField form={form} name="kind" label="Kind" options={PLAN_KINDS.map((k) => ({ value: k, label: PLAN_KIND_LABELS[k] }))} />
          <TextField form={form} name="price" label={kind === "class_pack" ? "Pack price" : recurring ? "Price per period" : "Price"} inputMode="decimal" placeholder="149.00" />
        </div>
        {recurring ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField form={form} name="interval" label="Bills every" options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }]} />
            <TextField form={form} name="intervalCount" label="Number of intervals" type="number" min={1} max={12} />
          </div>
        ) : null}
        {kind === "contract" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField form={form} name="contractMonths" label="Contract length (months)" type="number" min={1} max={60} />
            <TextField form={form} name="earlyTerminationFee" label="Early termination fee" inputMode="decimal" placeholder="300.00" />
          </div>
        ) : null}
        {kind === "paid_in_full" ? <TextField form={form} name="termMonths" label="Months covered" type="number" min={1} max={60} /> : null}
        {kind === "class_pack" ? <TextField form={form} name="classPackSize" label="Classes in the pack" type="number" min={1} /> : null}
        {kind === "trial" ? <TextField form={form} name="trialDays" label="Trial length (days)" type="number" min={1} max={90} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField form={form} name="enrollmentFee" label="Enrollment fee" inputMode="decimal" placeholder="0.00" />
          <SelectField form={form} name="taxClass" label="Tax" options={options.taxClasses} />
        </div>
        <fieldset className="space-y-2 rounded-lg border border-default p-3">
          <legend className="px-1 text-sm font-medium">Attendance</legend>
          <CheckboxField form={form} name="unlimited" label="Unlimited classes" />
          {!unlimited ? <TextField form={form} name="classesPerWeek" label="Classes per week" type="number" min={1} max={14} /> : null}
        </fieldset>
        <fieldset className="grid gap-3 rounded-lg border border-default p-3 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium">Family discount</legend>
          <TextField form={form} name="secondPct" label="2nd family member (% off)" type="number" min={0} max={100} />
          <TextField form={form} name="thirdPlusPct" label="3rd and later (% off)" type="number" min={0} max={100} />
        </fieldset>
        <MultiCheckField form={form} name="programIds" legend="Program access" options={options.programs} />
        {options.retail ? <MultiCheckField form={form} name="gearProductIds" legend="Enrollment kit (included gear)" options={options.products} /> : null}
        <div className="flex flex-wrap gap-4">
          {recurring ? <CheckboxField form={form} name="autoRenew" label="Auto-renew" /> : null}
          <CheckboxField form={form} name="isPublic" label="Show on the public site" />
          <CheckboxField form={form} name="active" label="Active" />
        </div>
        <FormError form={form} />
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial.id ? "Save plan" : "Create plan"}</Button>
      </form>
    </Form>
  );
}

export function PlanDialog({ initial, options }: { initial?: PlanInput; options: PlanFormOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? <Button variant="outline" size="sm">Edit</Button> : <Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> New plan</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New membership plan"}</DialogTitle>
          <DialogDescription>Prices are in your school&apos;s currency; changes apply to new enrollments and future invoices.</DialogDescription>
        </DialogHeader>
        <PlanFields initial={initial ?? EMPTY_PLAN} options={options} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
