import type { Metadata } from "next";
import "@repo/ui/globals.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "KoryoGraph Desk | Studio Command Center",
  description:
    "Back-office admin brain for KoryoGraph — manage your studio's CRM, attendance, billing, and AI workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="koryo-red">
      <body>{children}</body>
    </html>
  );
}
