"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { THEME_COOKIE, type Theme } from "./themes";

export { THEMES, THEME_COOKIE, isTheme, themeScheme, type Theme } from "./themes";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  /** Theme resolved on the server (cookie / profile) so the first paint is correct. */
  initialTheme: Theme;
  /** Optional persistence hook, e.g. a server action writing profiles.preferred_theme. */
  onPersist?: (theme: Theme) => unknown;
  children: ReactNode;
}

export function ThemeProvider({ initialTheme, onPersist, children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      document.documentElement.dataset.theme = next;
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      if (onPersist) void Promise.resolve(onPersist(next));
    },
    [onPersist],
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
