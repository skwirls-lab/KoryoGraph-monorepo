"use client";

import { useState } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Form } from "@koryo/ui/components/ui/form";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { TimezoneField } from "@/components/forms/timezone-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { signupSchema } from "@/lib/validation/signup";
import { signUpWithSchool } from "@/server/auth/actions";

export function SignupForm({ plan, planName }: { plan?: string; planName?: string }) {
  const [confirmTo, setConfirmTo] = useState<string | null>(null);
  const { form, pending, submit } = useActionForm({
    schema: signupSchema,
    defaultValues: { schoolName: "", fullName: "", email: "", password: "", timezone: "", plan },
    action: signUpWithSchool,
    onSuccess: (d, v) => {
      if (d.confirmEmail) setConfirmTo(v.email);
    },
  });
  if (confirmTo) {
    return (
      <p role="status" className="rounded-md border border-default bg-elevated p-4 text-sm">
        Check <strong>{confirmTo}</strong> for a confirmation link. After you confirm, we&apos;ll finish setting up your school.
      </p>
    );
  }
  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {planName ? <p className="rounded-md border border-default bg-elevated p-3 text-sm">Plan: <strong>{planName}</strong> — you&apos;ll confirm it when you go live. The trial includes every module.</p> : null}
        <TextField form={form} name="schoolName" label="School name" autoComplete="organization" />
        <TextField form={form} name="fullName" label="Your name" autoComplete="name" />
        <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
        <TextField form={form} name="password" label="Password" type="password" autoComplete="new-password" description="At least 8 characters." />
        <TimezoneField form={form} name="timezone" />
        <FormError form={form} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating your school…" : "Start 14-day trial"}
        </Button>
      </form>
    </Form>
  );
}
