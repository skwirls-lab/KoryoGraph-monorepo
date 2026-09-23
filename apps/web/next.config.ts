import type { NextConfig } from "next";

// Env comes from the repo-root `.env.local`, loaded by the npm scripts (`node --env-file-if-exists`).

const nextConfig: NextConfig = {
  transpilePackages: ["@koryo/ui"],
  serverExternalPackages: ["ffmpeg-static"],
  poweredByHeader: false,
  // The Content-Security-Policy (with a per-request nonce, incl. frame-ancestors) is set in src/proxy.ts.
  // Only the public trial form (/s/…, embedded by the widget) may be framed by other sites.
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Camera/microphone: class recordings and practice clips (our own origin only).
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(self \"https://js.stripe.com\")" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
    ];
    return [
      { source: "/:path*", headers: common },
      { source: "/((?!s/).*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
  // `NEXT_DIST_DIR` lets the security gate build into its own folder while `npm run dev` uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // forbidden() → real 403 pages for surface authorisation.
    authInterrupts: true,
    // Document vault uploads go through server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
