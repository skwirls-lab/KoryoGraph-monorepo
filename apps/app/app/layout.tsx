import type { Metadata } from "next";
import "@repo/ui/globals.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "KoryoGraph App | Mat-Side Instructor Engine",
  description:
    "Tablet-optimized mat-side helper for instructors to check attendance, logs, and biomechanical technique updates.",
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
