"use client";

import { Button } from "@koryo/ui/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { startThread } from "@/server/actions/messaging";

const schema = z.object({ subject: z.string().trim().min(2, { error: "Add a subject" }).max(120), body: z.string().trim().min(1, { error: "Write a message" }).max(5000) });

export function NewThreadForm() {
  const { form, pending, submit } = useActionForm({ schema, defaultValues: { subject: "", body: "" }, action: startThread });
  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-default bg-surface p-4" noValidate aria-label="New message to the school">
        <TextField form={form} name="subject" label="Subject" placeholder="e.g. Question about Saturday's test" />
        <FormField control={form.control} name="body" render={({ field }) => (
          <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormError form={form} />
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send to the school"}</Button>
      </form>
    </Form>
  );
}
