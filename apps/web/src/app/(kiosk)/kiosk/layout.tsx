import type { ReactNode } from "react";

/** Kiosk: full-screen, no chrome. Device pairing and PIN lock arrive in M1.09. */
export default function KioskLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
