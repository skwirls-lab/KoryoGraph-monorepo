"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";

/** The form-level (root) error from a server action, announced to screen readers. */
export function FormError<T extends FieldValues>({ form }: { form: UseFormReturn<T> }) {
  const message = form.formState.errors.root?.message;
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
