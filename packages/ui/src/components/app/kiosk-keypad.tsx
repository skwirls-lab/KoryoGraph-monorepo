"use client";

import { Delete } from "lucide-react";
import { useState } from "react";
import { cn } from "@koryo/ui/lib/utils";

export interface KioskKeypadProps {
  length?: number;
  label: string;
  disabled?: boolean;
  onComplete: (pin: string) => void;
}

/** Large PIN keypad for the kiosk (≥ 72px keys). Masks digits; submits when `length` digits are entered. */
export function KioskKeypad({ length = 4, label, disabled, onComplete }: KioskKeypadProps) {
  const [pin, setPin] = useState("");
  const press = (d: string) => {
    if (disabled || pin.length >= length) return;
    const next = pin + d;
    setPin(next);
    if (next.length === length) {
      onComplete(next);
      setPin("");
    }
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="mx-auto w-full max-w-xs space-y-4">
      <div className="flex justify-center gap-3" aria-label={`${label}: ${pin.length} of ${length} digits entered`} role="status">
        {Array.from({ length }, (_, i) => (
          <span key={i} className={cn("size-4 rounded-full border-2 border-strong", i < pin.length && "border-brand bg-brand")} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3" role="group" aria-label={label}>
        {keys.map((k) => (
          <button key={k} type="button" disabled={disabled} onClick={() => press(k)} className="h-18 rounded-2xl border border-default bg-surface font-display text-3xl font-bold active:bg-elevated disabled:opacity-50">
            {k}
          </button>
        ))}
        <button type="button" disabled={disabled || pin.length === 0} onClick={() => setPin("")} className="h-18 rounded-2xl text-base text-fg-secondary disabled:opacity-40">
          Clear
        </button>
        <button type="button" disabled={disabled} onClick={() => press("0")} className="h-18 rounded-2xl border border-default bg-surface font-display text-3xl font-bold active:bg-elevated disabled:opacity-50">
          0
        </button>
        <button type="button" aria-label="Delete last digit" disabled={disabled || pin.length === 0} onClick={() => setPin(pin.slice(0, -1))} className="flex h-18 items-center justify-center rounded-2xl text-fg-secondary disabled:opacity-40">
          <Delete className="size-7" />
        </button>
      </div>
    </div>
  );
}
