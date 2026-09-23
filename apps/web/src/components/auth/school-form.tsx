"use client";

import { Button } from "@koryo/ui/components/ui/button";
import { Form } from "@koryo/ui/components/ui/form";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { TimezoneField } from "@/components/forms/timezone-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { schoolSchema } from "@/lib/validation/signup";
import { createTenantForCurrentUser } from "@/server/actions/tenant";

/** For a signed-in user without a school (e.g. after confirming their email). */
export function SchoolForm({ defaultName = "", defaultTimezone = "", plan }: { defaultName?: string; defaultTimezone?: string; plan?: string }) {
  const { form, pending, submit } = useActionForm({
    schema: schoolSchema,
    defaultValues: { schoolName: defaultName, timezone: defaultTimezone, plan },
    action: createTenantForCurrentUser,
  });
  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField form={form} name="schoolName" label="School name" autoComplete="organization" />
        <TimezoneField form={form} name="timezone" />
        <FormError form={form} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating your school…" : "Create school"}
        </Button>
      </form>
    </Form>
  );
}
