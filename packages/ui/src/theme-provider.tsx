"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light" | "midnight" | "warm";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: { id: Theme; label: string; description: string }[];
}

const THEMES: ThemeContextValue["themes"] = [
  { id: "dark",     label: "Dark",     description: "Slate-black with indigo accents" },
  { id: "light",    label: "Light",    description: "Clean white with violet accents" },
  { id: "midnight", label: "Midnight", description: "Deep navy with soft blue accents" },
  { id: "warm",     label: "Warm",     description: "Charcoal with amber/gold accents" },
];

const STORAGE_KEY = "koryograph-theme";
const DEFAULT_THEME: Theme = "dark";

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // On mount, read from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && THEMES.find((t) => t.id === stored)) {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  // Apply theme to <html> data-theme attribute
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  // Prevent flash of wrong theme
  if (!mounted) {
    return (
      <html lang="en" data-theme={defaultTheme}>
        <body>{children}</body>
      </html>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
