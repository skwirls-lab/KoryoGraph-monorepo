"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";
import { Input } from "@koryo/ui/components/ui/input";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { CATEGORY_LABELS, SKILL_CATEGORIES } from "@/lib/curriculum";
import { skillSchema, type SkillInput } from "@/lib/validation/curriculum";
import { saveSkill } from "@/server/actions/curriculum";

const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-fg";

export function SkillDialog({ initial, programs, trigger }: { initial?: SkillInput; programs: { id: string; name: string }[]; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const defaults: SkillInput = initial ?? {
    programId: "", category: "kick", name: "", description: "", videoUrl: "",
    rubric: [{ criterion: "Technique", weight: 0.5 }, { criterion: "Power & focus", weight: 0.3 }, { criterion: "Balance", weight: 0.2 }],
  };
  const { form, pending, submit } = useActionForm({
    schema: skillSchema,
    defaultValues: defaults,
    action: saveSkill,
    onSuccess: () => { toast.success("Skill saved"); setOpen(false); if (!initial) form.reset(defaults); },
  });
  const rubric = useFieldArray({ control: form.control, name: "rubric" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit skill" : "New skill"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <TextField form={form} name="name" label="Name" placeholder="Front kick (ap chagi)" />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>Category</FormLabel><FormControl>
                  <select {...field} className={selectClass}>{SKILL_CATEGORIES.map((c) => <option key={c} value={c} className="bg-surface">{CATEGORY_LABELS[c]}</option>)}</select>
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="programId" render={({ field }) => (
                <FormItem><FormLabel>Program</FormLabel><FormControl>
                  <select {...field} value={field.value ?? ""} className={selectClass}>
                    <option value="" className="bg-surface">Shared by all programs</option>
                    {programs.map((p) => <option key={p.id} value={p.id} className="bg-surface">{p.name}</option>)}
                  </select>
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <TextField form={form} name="videoUrl" label="Video link" type="url" placeholder="https://…" />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Rubric</legend>
              {rubric.fields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Input aria-label={`Criterion ${i + 1}`} {...form.register(`rubric.${i}.criterion`)} className="flex-1" />
                  <Input aria-label={`Weight ${i + 1}`} type="number" step="0.05" min={0} max={1} {...form.register(`rubric.${i}.weight`)} className="w-24" />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove criterion ${i + 1}`} onClick={() => rubric.remove(i)}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => rubric.append({ criterion: "", weight: 0.1 })}><Plus aria-hidden className="size-4" /> Add criterion</Button>
            </fieldset>
            <FormError form={form} />
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save skill"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
