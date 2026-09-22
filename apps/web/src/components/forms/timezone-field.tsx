"use client";

import { useEffect, useMemo } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@koryo/ui/components/ui/form";

const FALLBACK = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"];

/** Native select of IANA zones; defaults to the browser's zone after mount (no hydration mismatch). */
export function TimezoneField<T extends FieldValues>({ form, name, label = "Timezone" }: { form: UseFormReturn<T>; name: Path<T>; label?: string }) {
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return FALLBACK;
    }
  }, []);

  useEffect(() => {
    if (form.getValues(name)) return;
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    form.setValue(name, (zones.includes(local) ? local : "America/New_York") as PathValue<T, Path<T>>);
  }, [form, name, zones]);

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <select
              {...field}
              value={(field.value as string | undefined) ?? ""}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-base text-fg shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
            >
              <option value="" disabled>
                Choose a timezone
              </option>
              {zones.map((z) => (
                <option key={z} value={z} className="bg-surface">
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
