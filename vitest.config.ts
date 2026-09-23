import path from "node:path";
import { defineConfig } from "vitest/config";

// Next's loader skips .env.local when NODE_ENV=test, so load it directly (existing vars win).
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, file));
  } catch {
    // optional file
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "apps/web/src"),
      // `server-only` throws outside the react-server condition; tests import server modules directly.
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    env: { LOG_LEVEL: "warn" },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "packages/*/src/**/*.test.ts",
            "packages/*/src/**/*.test.tsx",
            "apps/web/src/**/*.test.ts",
            "tests/unit/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          // Run by the M5 gate after a production build into apps/web/.next-audit (NEXT_DIST_DIR).
          name: "bundle",
          environment: "node",
          include: ["tests/security/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "seed",
          environment: "node",
          include: ["tests/seed/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
