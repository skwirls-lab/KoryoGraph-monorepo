import type { NextConfig } from "next";

// Env comes from the repo-root `.env.local`, loaded by the npm scripts (`node --env-file-if-exists`).

const nextConfig: NextConfig = {
  transpilePackages: ["@koryo/ui"],
  poweredByHeader: false,
  experimental: {
    // forbidden() → real 403 pages for surface authorisation.
    authInterrupts: true,
    // Document vault uploads go through server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
