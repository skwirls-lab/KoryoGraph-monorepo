import type { Metadata } from "next";
import "@repo/ui/globals.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "KoryoGraph Home | Student & Family Companion Portal",
  description:
    "View your training milestones, biomechanical feedback, pay membership dues, and book classes.",
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
