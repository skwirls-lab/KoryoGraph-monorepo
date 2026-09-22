import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres, { type Sql } from "postgres";
import { requireEnv } from "../lib/env";
import { sid } from "../lib/ids";

export const DEMO_PASSWORD = "KoryoDemo!2026";

export interface SeedContext {
  sql: Sql;
  admin: SupabaseClient;
  log: (msg: string) => void;
}

export function createSeedContext(): SeedContext {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres", {
    max: 8,
    onnotice: () => undefined,
  });
  const admin = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { sql, admin, log: (m) => console.log(`[seed] ${m}`) };
}

/** Create (or keep) a confirmed auth user with a deterministic id. Retries while GoTrue restarts after a reset. */
export async function ensureUser(ctx: SeedContext, email: string, fullName: string, password = DEMO_PASSWORD): Promise<string> {
  const id = sid(`user:${email}`);
  const [existing] = await ctx.sql<{ id: string }[]>`select id from auth.users where id = ${id}`;
  if (existing) return id;
  let lastError = "";
  for (let attempt = 0; attempt < 30; attempt++) {
    const { error } = await ctx.admin.auth.admin.createUser({
      id,
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    } as Parameters<typeof ctx.admin.auth.admin.createUser>[0]);
    if (!error) return id;
    lastError = error.message;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`createUser ${email} failed: ${lastError}`);
}
