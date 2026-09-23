import type { NextConfig } from "next";

// Env comes from the repo-root `.env.local`, loaded by the npm scripts (`node --env-file-if-exists`).

const nextConfig: NextConfig = {
  transpilePackages: ["@koryo/ui"],
  serverExternalPackages: ["ffmpeg-static"],
  poweredByHeader: false,
  // Only the public trial form (/s/…, embedded by the widget) may be framed by other sites.
  async headers() {
    return [
      { source: "/((?!s/).*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      { source: "/s/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
  experimental: {
    // forbidden() → real 403 pages for surface authorisation.
    authInterrupts: true,
    // Document vault uploads go through server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
