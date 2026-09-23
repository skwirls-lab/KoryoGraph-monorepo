import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { ThemeProvider } from "@koryo/ui/components/theme/theme";
import { THEME_COOKIE, isTheme, type Theme } from "@koryo/ui/components/theme/themes";
import { Toaster } from "@koryo/ui/components/ui/sonner";
import { TooltipProvider } from "@koryo/ui/components/ui/tooltip";
import { saveThemePreference } from "@/server/actions/session";
import { getOptionalCtx } from "@/server/context";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"),
  title: { default: "KoryoGraph", template: "%s · KoryoGraph" },
  description: "The operating system for martial arts schools.",
  openGraph: { siteName: "KoryoGraph", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** Theme: cookie → profile preference → surface default (Home is light for parents in daylight). */
async function resolveTheme(signedIn: boolean, userId: string | null, supabase: Awaited<ReturnType<typeof getOptionalCtx>>): Promise<Theme> {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  if (isTheme(stored)) return stored;
  if (signedIn && userId && supabase) {
    const { data } = await supabase.supabase.from("profiles").select("preferred_theme").eq("id", userId).maybeSingle();
    if (isTheme(data?.preferred_theme)) return data.preferred_theme;
  }
  const path = (await headers()).get("x-kg-path") ?? "";
  return path === "/home" || path.startsWith("/home/") ? "light" : "koryo-red";
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const ctx = await getOptionalCtx();
  const theme = await resolveTheme(Boolean(ctx), ctx?.userId ?? null, ctx);
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <NuqsAdapter>
          <ThemeProvider initialTheme={theme} onPersist={ctx ? saveThemePreference : undefined}>
            <TooltipProvider>
              {children}
              <Toaster closeButton />
            </TooltipProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
