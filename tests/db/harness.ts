import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import type { Database } from "../../packages/db/src/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const dbUrl = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — run tests with the repo .env.local (see CLAUDE.md)`);
  return v;
}

/** Superuser SQL connection for catalogue queries and fixtures (bypasses RLS). */
export const sql = postgres(dbUrl, { max: 4, onnotice: () => undefined });

/** Service-role API client (auth admin). */
export const admin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const PASSWORD = "KoryoTest!2026";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@test.koryograph.local`;
}

/** Recreate the database from migrations + seed.sql (slow; the gate does this once per run). */
export function resetDb(): void {
  execSync("npx supabase db reset", { stdio: "inherit" });
}

export async function createUser(email: string, fullName = "Test User"): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return data.user.id;
}

export interface Session {
  client: SupabaseClient<Database>;
  accessToken: string;
  claims: Record<string, unknown> & { app_metadata?: Record<string, unknown> };
  userId: string;
}

/** Sign in with password → a user-scoped client whose requests carry the user's JWT (RLS applies). */
export async function signIn(email: string, password = PASSWORD): Promise<Session> {
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn failed for ${email}: ${error?.message}`);
  return {
    client,
    accessToken: data.session.access_token,
    claims: decodeJwt(data.session.access_token),
    userId: data.session.user.id,
  };
}

/** `mintSession(email)`: create a confirmed user (if needed) and sign them in. */
export async function mintSession(email: string): Promise<Session> {
  const existing = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
  if (existing.length === 0) await createUser(email);
  return signIn(email);
}

export function decodeJwt(token: string): Session["claims"] {
  const part = token.split(".")[1];
  if (!part) throw new Error("malformed JWT");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Session["claims"];
}

/** Create a tenant owned by a fresh user; returns ids. Runs as superuser (seed-style). */
export async function createTenantWithOwner(name: string): Promise<{ tenantId: string; ownerEmail: string; ownerId: string }> {
  const ownerEmail = uniqueEmail("owner");
  const ownerId = await createUser(ownerEmail, `${name} Owner`);
  const [row] = await sql<{ id: string }[]>`select app.create_tenant(${name}, ${null}, ${"America/New_York"}, ${ownerId}) as id`;
  if (!row) throw new Error("create_tenant returned nothing");
  return { tenantId: row.id, ownerEmail, ownerId };
}

/** Add a user to a tenant with a role key; returns the user's email. */
export async function addMember(tenantId: string, roleKey: string, email = uniqueEmail(roleKey)): Promise<string> {
  const userId = await createUser(email, `${roleKey} member`);
  await sql`
    insert into public.tenant_users (tenant_id, user_id, role_id, status, accepted_at)
    select ${tenantId}, ${userId}, r.id, 'active', now() from public.roles r where r.tenant_id = ${tenantId} and r.key = ${roleKey}`;
  await sql`update public.profiles set active_tenant_id = ${tenantId} where id = ${userId}`;
  return email;
}
