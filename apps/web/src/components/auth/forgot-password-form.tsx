"use client";

import { useState } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Form } from "@koryo/ui/components/ui/form";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/server/auth/actions";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { form, pending, submit } = useActionForm({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
    action: requestPasswordReset,
    onSuccess: (_d, v) => setSentTo(v.email),
  });
  if (sentTo) {
    return (
      <p role="status" className="rounded-md border border-default bg-elevated p-4 text-sm">
        If <strong>{sentTo}</strong> has an account, we&apos;ve sent a link to reset the password.
      </p>
    );
  }
  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
        <FormError form={form} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </Form>
  );
}
