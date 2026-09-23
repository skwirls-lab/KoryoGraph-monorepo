import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
  return { rules: [{ userAgent: "*", allow: ["/", "/s/"], disallow: ["/desk", "/mat", "/home", "/kiosk", "/api", "/auth", "/welcome"] }], sitemap: `${base}/sitemap.xml` };
}
