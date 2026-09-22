import { parseArgs } from "node:util";
import { loadEnv } from "../lib/env";
import { createSeedContext } from "./context";
import { seedMinimal } from "./minimal";

loadEnv();

const PROFILES = ["minimal", "demo"] as const;
type Profile = (typeof PROFILES)[number];

const { values } = parseArgs({ options: { profile: { type: "string", default: "minimal" } }, allowPositionals: true });
const profile = values.profile as Profile;
if (!PROFILES.includes(profile)) {
  console.error(`Unknown profile "${profile}". Use one of: ${PROFILES.join(", ")}`);
  process.exit(2);
}

const ctx = createSeedContext();
const started = Date.now();
try {
  await seedMinimal(ctx);
  if (profile === "demo") {
    throw new Error("The demo profile (Ridgeline v1) is built in M1.14.");
  }
  ctx.log(`profile ${profile} done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
} finally {
  await ctx.sql.end();
}
