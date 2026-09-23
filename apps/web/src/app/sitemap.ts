import type { MetadataRoute } from "next";

const PAGES = ["/", "/features", "/pricing", "/contact", "/signup", "/login", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
  return PAGES.map((p) => ({ url: `${base}${p === "/" ? "" : p}`, changeFrequency: p === "/" || p === "/pricing" ? "weekly" : "monthly", priority: p === "/" ? 1 : 0.6 }));
}
