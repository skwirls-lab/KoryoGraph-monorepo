import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Load the repo-root .env.local / .env into process.env (existing variables win). */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(ROOT, file));
    } catch {
      // optional file
    }
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
}

export const repoRoot = ROOT;
