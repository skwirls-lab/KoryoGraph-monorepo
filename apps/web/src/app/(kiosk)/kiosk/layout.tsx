import type { ReactNode } from "react";

/** Kiosk: full-screen, no chrome (device-paired; see /kiosk). */
export default function KioskLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
