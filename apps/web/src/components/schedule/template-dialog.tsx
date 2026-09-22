"use client";

import { WEEKDAYS, type WeekdayCode } from "@koryo/scheduling";
import { useState, type ReactNode } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";
import { Label } from "@koryo/ui/components/ui/label";
import { cn } from "@koryo/ui/lib/utils";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { templateSchema, type TemplateInput } from "@/lib/validation/schedule";
import { saveTemplate } from "@/server/actions/schedule";

const DAY_LABEL: Record<WeekdayCode, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };

export interface ScheduleOptions {
  locations: { id: string; name: string }[];
  programs: { id: string; name: string }[];
  staff: { id: string; name: string }[];
}

function MultiCheck({ legend, options, value, onChange, idPrefix }: { legend: string; options: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void; idPrefix: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      {options.length === 0 ? <p className="text-sm text-fg-muted">None yet.</p> : null}
      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
        {options.map((o) => (
          <li key={o.id} className="flex items-center gap-2">
            <Checkbox id={`${idPrefix}-${o.id}`} checked={value.includes(o.id)} onCheckedChange={(c) => onChange(c ? [...value, o.id] : value.filter((x) => x !== o.id))} />
            <Label htmlFor={`${idPrefix}-${o.id}`} className="font-normal">{o.name}</Label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export function TemplateDialog({ initial, options, trigger, today }: { initial?: TemplateInput; options: ScheduleOptions; trigger: ReactNode; today: string }) {
  const [open, setOpen] = useState(false);
  const defaults: TemplateInput = initial ?? {
    name: "", locationId: options.locations[0]?.id ?? "", programIds: [], days: ["MO", "WE"], interval: 1, startTime: "17:00", durationMin: 60,
    startDate: today, untilDate: "", capacity: 20, instructorIds: [], rankMin: "", rankMax: "", ageMin: "", ageMax: "", room: "", bookable: false, cancellationWindowMin: 120,
  };
  const { form, pending, submit } = useActionForm({
    schema: templateSchema,
    defaultValues: defaults,
    action: saveTemplate,
    onSuccess: () => { toast.success(initial ? "Class updated — future sessions regenerated" : "Class added to the schedule"); setOpen(false); if (!initial) form.reset(defaults); },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New recurring class"}</DialogTitle>
          <DialogDescription>Sessions are generated for the next 90 days and kept in sync when you change this.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="name" label="Class name" placeholder="Youth Taekwondo" />
              <FormField control={form.control} name="locationId" render={({ field }) => (
                <FormItem><FormLabel>Location</FormLabel><FormControl>
                  <select {...field} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-fg">
                    {options.locations.map((l) => <option key={l.id} value={l.id} className="bg-surface">{l.name}</option>)}
                  </select>
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <Controller control={form.control} name="days" render={({ field, fieldState }) => (
              <fieldset>
                <legend className="text-sm font-medium">Repeats on</legend>
                <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Days of the week">
                  {WEEKDAYS.map((d) => {
                    const on = (field.value ?? []).includes(d);
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => field.onChange(on ? field.value.filter((x: string) => x !== d) : [...(field.value ?? []), d])}
                        className={cn("min-h-10 min-w-12 rounded-md border px-2 text-sm", on ? "border-brand bg-brand text-brand-foreground" : "border-default bg-surface text-fg")}>
                        {DAY_LABEL[d]}
                      </button>
                    );
                  })}
                </div>
                {fieldState.error ? <p className="mt-1 text-sm text-danger">{fieldState.error.message}</p> : null}
              </fieldset>
            )} />
            <div className="grid gap-4 sm:grid-cols-4">
              <TextField form={form} name="startTime" label="Start time" type="time" />
              <TextField form={form} name="durationMin" label="Minutes" type="number" min={10} />
              <TextField form={form} name="startDate" label="Starts" type="date" />
              <TextField form={form} name="untilDate" label="Ends (optional)" type="date" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField form={form} name="capacity" label="Capacity" type="number" min={1} />
              <TextField form={form} name="room" label="Room" />
              <TextField form={form} name="interval" label="Every N weeks" type="number" min={1} max={4} />
            </div>
            <Controller control={form.control} name="programIds" render={({ field }) => (
              <MultiCheck legend="Programs" idPrefix="tp" options={options.programs} value={field.value ?? []} onChange={field.onChange} />
            )} />
            <Controller control={form.control} name="instructorIds" render={({ field }) => (
              <MultiCheck legend="Instructors" idPrefix="ti" options={options.staff} value={field.value ?? []} onChange={field.onChange} />
            )} />
            <div className="grid gap-4 sm:grid-cols-4">
              <TextField form={form} name="rankMin" label="Min rank #" type="number" min={1} />
              <TextField form={form} name="rankMax" label="Max rank #" type="number" min={1} />
              <TextField form={form} name="ageMin" label="Min age" type="number" min={0} />
              <TextField form={form} name="ageMax" label="Max age" type="number" min={0} />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <CheckboxField form={form} name="bookable" label="Members book this class (capacity enforced)" />
              <TextField form={form} name="cancellationWindowMin" label="Cancel up to (minutes before)" type="number" min={0} />
            </div>
            <FormError form={form} />
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save class" : "Add class"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
