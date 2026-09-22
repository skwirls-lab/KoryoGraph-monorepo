"use client";

import { Palette } from "lucide-react";
import { THEMES, isTheme, useTheme } from "@koryo/ui/components/theme/theme";

const labels: Record<(typeof THEMES)[number], string> = {
  "koryo-red": "Koryo Red",
  dark: "Dark",
  light: "Light",
  midnight: "Midnight",
  warm: "Warm",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <label className={className}>
      <span className="sr-only">Theme</span>
      <span className="inline-flex items-center gap-2 rounded-md border border-default bg-surface px-2 py-1 text-sm">
        <Palette aria-hidden className="size-4 text-fg-muted" />
        <select
          value={theme}
          onChange={(e) => {
            if (isTheme(e.target.value)) setTheme(e.target.value);
          }}
          className="bg-transparent text-fg outline-none"
        >
          {THEMES.map((t) => (
            <option key={t} value={t} className="bg-surface text-fg">
              {labels[t]}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
