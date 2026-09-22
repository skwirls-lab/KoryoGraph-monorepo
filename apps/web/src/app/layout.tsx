import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ThemeProvider } from "@koryo/ui/components/theme/theme";
import { THEME_COOKIE, isTheme, type Theme } from "@koryo/ui/components/theme/themes";
import { Toaster } from "@koryo/ui/components/ui/sonner";
import { TooltipProvider } from "@koryo/ui/components/ui/tooltip";

export const metadata: Metadata = {
  title: { default: "KoryoGraph", template: "%s · KoryoGraph" },
  description: "The operating system for martial arts schools.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(stored) ? stored : "koryo-red";
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>
        <ThemeProvider initialTheme={theme}>
          <TooltipProvider>
            {children}
            <Toaster richColors closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
