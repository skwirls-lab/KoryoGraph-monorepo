import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Env lives in the repo root `.env.local` (shared with scripts, tests and the Supabase CLI).
loadEnvConfig(path.resolve(process.cwd(), "../.."));

const nextConfig: NextConfig = {
  transpilePackages: ["@koryo/ui"],
  poweredByHeader: false,
  experimental: {
    // forbidden() → real 403 pages for surface authorisation.
    authInterrupts: true,
  },
};

export default nextConfig;
