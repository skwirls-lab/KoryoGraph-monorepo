"use client";

import type { ReactNode } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-base text-fg shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm";

/** Native select bound to react-hook-form. */
export function SelectField<T extends FieldValues>({ form, name, label, options, description, placeholder }: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: ReactNode;
  options: readonly { value: string; label: string }[];
  description?: ReactNode;
  placeholder?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <select {...field} value={(field.value as string | undefined) ?? ""} className={selectClass}>
              {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
              {options.map((o) => <option key={o.value} value={o.value} className="bg-surface">{o.label}</option>)}
            </select>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** A group of checkboxes writing a string[] (e.g. program ids). */
export function MultiCheckField<T extends FieldValues>({ form, name, legend, options }: {
  form: UseFormReturn<T>;
  name: Path<T>;
  legend: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const value = (field.value as string[] | undefined) ?? [];
        return (
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">{legend}</legend>
            {options.length === 0 ? <p className="text-sm text-fg-muted">None available.</p> : null}
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={value.includes(o.value)}
                  onChange={(e) => field.onChange(e.target.checked ? [...value, o.value] : value.filter((x) => x !== o.value))}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        );
      }}
    />
  );
}
