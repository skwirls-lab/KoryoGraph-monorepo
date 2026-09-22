"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch } from "react-hook-form";
import { Button } from "@koryo/ui/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { CONSENT_KINDS, CONSENT_LABELS, isMinor } from "@/lib/people";
import { newHouseholdSchema } from "@/lib/validation/people";
import { createHousehold } from "@/server/actions/people";

const emptyGuardian = { firstName: "", lastName: "", email: "", phone: "", emailConsent: true, smsConsent: false };
const emptyStudent = {
  firstName: "", lastName: "", dob: "", allergies: "", status: "active" as const,
  consents: { media_release: false, ai_processing: false, messaging: false, photo: false },
};

export function NewHouseholdForm({ today }: { today: string }) {
  const { form, pending, submit } = useActionForm({
    schema: newHouseholdSchema,
    defaultValues: { householdName: "", guardians: [emptyGuardian], students: [emptyStudent] },
    action: createHousehold,
  });
  const guardians = useFieldArray({ control: form.control, name: "guardians" });
  const students = useFieldArray({ control: form.control, name: "students" });
  const watchedStudents = useWatch({ control: form.control, name: "students" });

  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-8" noValidate>
        <section className="space-y-4 rounded-xl border border-default bg-surface p-4 sm:p-6">
          <TextField form={form} name="householdName" label="Household name" placeholder="Cooper family" />
        </section>

        <section className="space-y-4" aria-labelledby="guardians-h">
          <div className="flex items-center justify-between">
            <h2 id="guardians-h" className="text-lg font-semibold">Guardians / adults</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => guardians.append(emptyGuardian)}>
              <Plus aria-hidden className="size-4" /> Add guardian
            </Button>
          </div>
          {guardians.fields.map((f, i) => (
            <fieldset key={f.id} className="grid gap-4 rounded-xl border border-default bg-surface p-4 sm:grid-cols-2 sm:p-6">
              <legend className="sr-only">Guardian {i + 1}</legend>
              <TextField form={form} name={`guardians.${i}.firstName`} label="First name" autoComplete="off" />
              <TextField form={form} name={`guardians.${i}.lastName`} label="Last name" autoComplete="off" />
              <TextField form={form} name={`guardians.${i}.email`} label="Email" type="email" autoComplete="off" />
              <TextField form={form} name={`guardians.${i}.phone`} label="Phone" type="tel" autoComplete="off" />
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                <CheckboxField form={form} name={`guardians.${i}.emailConsent`} label="OK to email" />
                <CheckboxField form={form} name={`guardians.${i}.smsConsent`} label="OK to text (SMS)" />
                <Button type="button" variant="ghost" size="sm" className="ml-auto text-danger" onClick={() => guardians.remove(i)}>
                  <Trash2 aria-hidden className="size-4" /> Remove
                </Button>
              </div>
            </fieldset>
          ))}
        </section>

        <section className="space-y-4" aria-labelledby="students-h">
          <div className="flex items-center justify-between">
            <h2 id="students-h" className="text-lg font-semibold">Students</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => students.append(emptyStudent)}>
              <Plus aria-hidden className="size-4" /> Add student
            </Button>
          </div>
          {students.fields.map((f, i) => {
            const dob = watchedStudents?.[i]?.dob;
            const minor = !dob || isMinor(dob, today);
            return (
              <fieldset key={f.id} className="grid gap-4 rounded-xl border border-default bg-surface p-4 sm:grid-cols-2 sm:p-6">
                <legend className="sr-only">Student {i + 1}</legend>
                <TextField form={form} name={`students.${i}.firstName`} label="First name" autoComplete="off" />
                <TextField form={form} name={`students.${i}.lastName`} label="Last name" autoComplete="off" />
                <TextField form={form} name={`students.${i}.dob`} label="Date of birth" type="date" />
                <FormField
                  control={form.control}
                  name={`students.${i}.status`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <select {...field} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-fg">
                          <option value="active" className="bg-surface">Active</option>
                          <option value="trial" className="bg-surface">Trial</option>
                          <option value="lead" className="bg-surface">Lead</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="sm:col-span-2">
                  <TextField form={form} name={`students.${i}.allergies`} label="Allergies" placeholder="Comma-separated, e.g. peanuts, bee stings" />
                </div>
                {minor ? (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-sm font-medium">Guardian consent (minor)</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CONSENT_KINDS.map((k) => (
                        <CheckboxField key={k} form={form} name={`students.${i}.consents.${k}`} label={CONSENT_LABELS[k]} />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => students.remove(i)}>
                    <Trash2 aria-hidden className="size-4" /> Remove student
                  </Button>
                </div>
              </fieldset>
            );
          })}
          <FormMessage>{form.formState.errors.students?.root?.message ?? form.formState.errors.students?.message}</FormMessage>
        </section>

        <FormError form={form} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save household"}</Button>
        </div>
      </form>
    </Form>
  );
}
