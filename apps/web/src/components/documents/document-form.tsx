"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { Button } from "@koryo/ui/components/ui/button";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";
import { Label } from "@koryo/ui/components/ui/label";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { z } from "zod";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { DOC_MERGE_FIELDS, DOCUMENT_KINDS, mergeDoc } from "@/lib/documents";
import { publishDocument } from "@/server/actions/documents";
import { DocumentBody } from "./document-body";

const schema = z.object({
  name: z.string().trim().min(2, { error: "Name the document" }).max(120),
  kind: z.enum(DOCUMENT_KINDS),
  body: z.string().trim().min(20, { error: "The document needs some text" }).max(50_000),
  allStudents: z.boolean(),
  programIds: z.array(z.uuid()),
});

export function DocumentForm({ initial, programs, nameLocked, submitLabel }: {
  initial: z.input<typeof schema>; programs: { id: string; name: string }[]; nameLocked?: boolean; submitLabel: string;
}) {
  const { form, pending, submit } = useActionForm({ schema, defaultValues: initial, action: publishDocument });
  const [preview, setPreview] = useState(false);
  const body = form.watch("body");
  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField form={form} name="name" label="Document name" readOnly={nameLocked} />
          <FormField control={form.control} name="kind" render={({ field }) => (
            <FormItem><FormLabel>Type</FormLabel><FormControl>
              <select {...field} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-fg">
                {DOCUMENT_KINDS.map((k) => <option key={k} value={k} className="bg-surface">{k.replace("_", " ")}</option>)}
              </select>
            </FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="doc-body">Text</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</Button>
          </div>
          {preview ? (
            <div className="rounded-xl border border-default bg-surface p-4"><DocumentBody body={mergeDoc(body ?? "", { student_name: "Maya Cooper", guardian_name: "Morgan Cooper", school_name: "Your school", date: "2026-09-22" })} /></div>
          ) : (
            <FormField control={form.control} name="body" render={({ field }) => (
              <FormItem><FormControl><Textarea id="doc-body" rows={14} className="font-mono text-sm" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          )}
          <p className="text-xs text-fg-muted">Format: <code># Heading</code>, <code>- bullet</code>, blank line between paragraphs. Merge fields: {DOC_MERGE_FIELDS.map((f) => `{{${f}}}`).join(" ")}</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Required for</legend>
          <CheckboxField form={form} name="allStudents" label="Every active student" />
          <Controller control={form.control} name="programIds" render={({ field }) => (
            <ul className="grid gap-1 sm:grid-cols-2">
              {programs.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Checkbox id={`dp-${p.id}`} checked={(field.value ?? []).includes(p.id)} onCheckedChange={(c) => field.onChange(c ? [...(field.value ?? []), p.id] : (field.value ?? []).filter((x: string) => x !== p.id))} />
                  <Label htmlFor={`dp-${p.id}`} className="font-normal">Students in {p.name}</Label>
                </li>
              ))}
            </ul>
          )} />
        </fieldset>
        <FormError form={form} />
        <Button type="submit" disabled={pending}>{pending ? "Publishing…" : submitLabel}</Button>
      </form>
    </Form>
  );
}
