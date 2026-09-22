"use client";

import { Button } from "@koryo/ui/components/ui/button";
import { Form } from "@koryo/ui/components/ui/form";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { updatePassword } from "@/server/auth/actions";

export function ResetPasswordForm() {
  const { form, pending, submit } = useActionForm({
    schema: resetPasswordSchema,
    defaultValues: { password: "", confirm: "" },
    action: updatePassword,
  });
  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField form={form} name="password" label="New password" type="password" autoComplete="new-password" />
        <TextField form={form} name="confirm" label="Confirm new password" type="password" autoComplete="new-password" />
        <FormError form={form} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </Form>
  );
}
