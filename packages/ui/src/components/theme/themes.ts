export const THEMES = ["koryo-red", "dark", "light", "midnight", "warm"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "kg-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function themeScheme(theme: Theme): "light" | "dark" {
  return theme === "light" ? "light" : "dark";
}
