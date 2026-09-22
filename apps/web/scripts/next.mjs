// Runs the Next CLI with the repo-root .env.local loaded into process.env (inherited by Next's workers).
// `node --env-file` can't be used: Next forwards execArgv via NODE_OPTIONS, which rejects that flag.
import path from "node:path";

for (const file of ["../../.env.local", "../../.env"]) {
  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, "..", file));
  } catch {
    // optional file
  }
}

await import("next/dist/bin/next");
