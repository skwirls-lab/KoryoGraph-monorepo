"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";
import { Label } from "@koryo/ui/components/ui/label";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { lessonPlanSchema, type LessonPlanInput } from "@/lib/validation/curriculum";
import { saveLessonPlan } from "@/server/actions/curriculum";

const DEFAULT_SECTIONS = [
  { title: "Warm-up", minutes: 10, skill_ids: [], notes: "" },
  { title: "Technique", minutes: 15, skill_ids: [], notes: "" },
  { title: "Forms", minutes: 10, skill_ids: [], notes: "" },
  { title: "Sparring / drills", minutes: 15, skill_ids: [], notes: "" },
  { title: "Cool-down", minutes: 5, skill_ids: [], notes: "" },
];

export function LessonPlanEditor({ initial, programs, skills }: {
  initial?: LessonPlanInput; programs: { id: string; name: string }[]; skills: { id: string; name: string; programId: string | null }[];
}) {
  const { form, pending, submit } = useActionForm({
    schema: lessonPlanSchema,
    defaultValues: initial ?? { name: "", programId: "", sections: DEFAULT_SECTIONS },
    action: saveLessonPlan,
    onSuccess: () => toast.success("Lesson plan saved"),
  });
  const sections = useFieldArray({ control: form.control, name: "sections" });
  const programId = useWatch({ control: form.control, name: "programId" });
  const watched = useWatch({ control: form.control, name: "sections" });
  const available = skills.filter((s) => !s.programId || !programId || s.programId === programId);
  const total = (watched ?? []).reduce((m, s) => m + (Number(s?.minutes) || 0), 0);

  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-6" noValidate>
        <div className="grid gap-4 rounded-xl border border-default bg-surface p-4 sm:grid-cols-2 sm:p-6">
          <TextField form={form} name="name" label="Plan name" placeholder="Green belt Tuesday" />
          <FormField control={form.control} name="programId" render={({ field }) => (
            <FormItem><FormLabel>Program</FormLabel><FormControl>
              <select {...field} value={field.value ?? ""} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-fg">
                <option value="" className="bg-surface">Any program</option>
                {programs.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
              </select>
            </FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sections <span className="text-sm font-normal text-fg-muted">· {total} minutes</span></h2>
          <Button type="button" variant="outline" size="sm" onClick={() => sections.append({ title: "", minutes: 10, skill_ids: [], notes: "" })}><Plus aria-hidden className="size-4" /> Add section</Button>
        </div>
        <ol className="space-y-3">
          {sections.fields.map((f, i) => {
            const selected = new Set(watched?.[i]?.skill_ids ?? []);
            return (
              <li key={f.id} className="space-y-3 rounded-xl border border-default bg-surface p-4" aria-label={`Section ${i + 1}`}>
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
                  <TextField form={form} name={`sections.${i}.title`} label="Title" />
                  <TextField form={form} name={`sections.${i}.minutes`} label="Minutes" type="number" min={0} />
                  <div className="flex items-end gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => sections.move(i, i - 1)}><ArrowUp className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={i === sections.fields.length - 1} onClick={() => sections.move(i, i + 1)}><ArrowDown className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove section" onClick={() => sections.remove(i)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
                {available.length > 0 ? (
                  <fieldset>
                    <legend className="text-sm font-medium">Curriculum items</legend>
                    <ul className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {available.map((s) => (
                        <li key={s.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`sec-${f.id}-${s.id}`}
                            checked={selected.has(s.id)}
                            onCheckedChange={(c) => {
                              const next = new Set(selected);
                              if (c) next.add(s.id); else next.delete(s.id);
                              form.setValue(`sections.${i}.skill_ids`, [...next], { shouldDirty: true });
                            }}
                          />
                          <Label htmlFor={`sec-${f.id}-${s.id}`} className="font-normal">{s.name}</Label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                ) : null}
                <FormField control={form.control} name={`sections.${i}.notes`} render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                )} />
              </li>
            );
          })}
        </ol>
        <FormError form={form} />
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save lesson plan"}</Button>
      </form>
    </Form>
  );
}
