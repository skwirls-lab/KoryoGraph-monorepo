import { createHash } from "node:crypto";
import postgres from "postgres";
import { loadEnv } from "./lib/env";

// Prints row count + a hash of sorted ids for every public table (tables without `id` hash their rows'
// natural keys via count only). Used to prove `db:reset` is deterministic: run twice, diff the output.
loadEnv();
const sql = postgres(process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres", { onnotice: () => undefined });
try {
  const tables = await sql<{ table_name: string; has_id: boolean }[]>`
    select t.table_name, exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'id') as has_id
    from information_schema.tables t where t.table_schema = 'public' and t.table_type = 'BASE TABLE' order by 1`;
  // audit_events ids are generated per write (not seed data) and are excluded from the id hash.
  for (const t of tables) {
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(t.table_name)}`;
    const n = row?.n ?? 0;
    let digest = "-";
    if (t.has_id && t.table_name !== "audit_events" && t.table_name !== "job_runs") {
      const ids = await sql<{ id: string }[]>`select id::text from ${sql(t.table_name)} order by id`;
      digest = createHash("sha256").update(ids.map((r) => r.id).join(",")).digest("hex").slice(0, 16);
    }
    console.log(`${t.table_name.padEnd(28)} ${String(n).padStart(7)} ${digest}`);
  }
} finally {
  await sql.end();
}
