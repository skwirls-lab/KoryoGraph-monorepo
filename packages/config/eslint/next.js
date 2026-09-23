import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";
import { honesty } from "./honesty.js";

/**
 * ESLint configuration for the Next.js app.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nextConfig = [
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  ...honesty,
  {
    ignores: [".next/**", ".next-audit/**", "out/**", "build/**", "next-env.d.ts", "**/*.gen.ts"],
  },
];

export default nextConfig;
