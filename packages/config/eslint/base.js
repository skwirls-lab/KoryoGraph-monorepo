import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import { honesty } from "./honesty.js";

/**
 * Shared ESLint configuration for TypeScript packages.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
    ignores: ["dist/**", "**/*.gen.ts", "node_modules/**"],
  },
];

export default config;
