"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Form } from "@koryo/ui/components/ui/form";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@koryo/ui/components/ui/sheet";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { updatePersonSchema, type UpdatePersonInput } from "@/lib/validation/people";
import { updatePerson } from "@/server/actions/people";

export function PersonEditSheet({ initial }: { initial: UpdatePersonInput }) {
  const [open, setOpen] = useState(false);
  const { form, pending, submit } = useActionForm({
    schema: updatePersonSchema,
    defaultValues: initial,
    action: updatePerson,
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
    },
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Pencil aria-hidden className="size-4" /> Edit</Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit details</SheetTitle>
          <SheetDescription>Changes are recorded in the audit log.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-4 px-4 pb-6" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="firstName" label="First name" />
              <TextField form={form} name="lastName" label="Last name" />
              <TextField form={form} name="preferredName" label="Preferred name" />
              <TextField form={form} name="dob" label="Date of birth" type="date" />
              <TextField form={form} name="email" label="Email" type="email" />
              <TextField form={form} name="phone" label="Phone" type="tel" />
            </div>
            <div className="flex flex-wrap gap-4">
              <CheckboxField form={form} name="emailConsent" label="OK to email" />
              <CheckboxField form={form} name="smsConsent" label="OK to text (SMS)" />
            </div>
            <TextField form={form} name="allergies" label="Allergies" description="Comma-separated." />
            <TextField form={form} name="injuryFlags" label="Injury flags" description="Comma-separated, e.g. left knee." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="uniformSize" label="Uniform size" />
              <TextField form={form} name="beltSize" label="Belt size" />
            </div>
            <FormError form={form} />
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
