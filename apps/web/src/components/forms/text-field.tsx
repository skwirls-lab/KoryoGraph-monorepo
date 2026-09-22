"use client";

import type { ComponentProps, ReactNode } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";
import { Input } from "@koryo/ui/components/ui/input";

export interface TextFieldProps<T extends FieldValues> extends Omit<ComponentProps<typeof Input>, "form" | "name"> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: ReactNode;
  description?: ReactNode;
}

export function TextField<T extends FieldValues>({ form, name, label, description, ...input }: TextFieldProps<T>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...input} {...field} value={(field.value as string | undefined) ?? ""} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
