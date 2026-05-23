import type { Metadata } from "next";
import "@repo/ui/globals.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "KoryoGraph | Sign In",
  description:
    "Sign in to KoryoGraph — the AI-native virtual staff member for martial arts studios.",
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
