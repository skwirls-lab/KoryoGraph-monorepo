"use client";

import type { ReactNode } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@koryo/ui/components/ui/form";

export function CheckboxField<T extends FieldValues>({ form, name, label }: { form: UseFormReturn<T>; name: Path<T>; label: ReactNode }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 space-y-0">
          <FormControl>
            <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(Boolean(v))} />
          </FormControl>
          <FormLabel className="font-normal">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}
