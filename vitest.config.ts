import path from "node:path";
import nextEnv from "@next/env";
import { defineConfig } from "vitest/config";

nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "apps/web/src") },
  },
  test: {
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
    ],
  },
});
