import { config } from "@koryo/config/eslint/base";

export default [
  ...config,
  { ignores: ["apps/**", "packages/**", "test-results/**", "playwright-report/**", "supabase/**", "docs/**"] },
];
