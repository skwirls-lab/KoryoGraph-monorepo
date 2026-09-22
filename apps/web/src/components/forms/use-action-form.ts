"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";

export interface ActionForm<T extends FieldValues> {
  form: UseFormReturn<T>;
  pending: boolean;
  submit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

/**
 * react-hook-form + zod + a server action. Client-side validation first; the action re-validates and
 * returns ActionResult. Field errors map onto inputs; anything else becomes the form's root error.
 * A redirect thrown by the action propagates normally.
 */
export function useActionForm<S extends z.ZodType<FieldValues, FieldValues>, R = undefined>(opts: {
  schema: S;
  defaultValues: DefaultValues<z.input<S>>;
  action: (values: z.output<S>) => Promise<ActionResult<R>>;
  onSuccess?: (data: R, values: z.output<S>) => void;
}): ActionForm<z.input<S>> {
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    // zodResolver cannot infer through the generic schema parameter; the schema is the contract.
    resolver: zodResolver(opts.schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>,
    defaultValues: opts.defaultValues,
  });
  const [pending, startTransition] = useTransition();

  const submit = form.handleSubmit((values) =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await opts.action(values);
        if (result.ok) {
          opts.onSuccess?.(result.data, values);
        } else {
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
            form.setError(field as Path<z.input<S>>, { message });
          }
          form.setError("root", { message: result.error });
        }
        resolve();
      });
    }),
  );

  return { form: form as unknown as UseFormReturn<z.input<S>>, pending, submit };
}
