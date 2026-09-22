import { strToU8, zipSync } from "fflate";
import type { Job } from "./types";

const REDACT = new Set(["secret", "token_hash", "pin_hash", "key_hash"]);
const PAGE = 1000;

/**
 * Full-tenant export (F1.7): one JSON file per tenant-scoped table plus the tenant record, zipped into
 * `<tenant>/exports/<export id>.zip` (private). Credentials (hashes/secrets) are redacted. Processes
 * queued `exports` rows; params.export limits the run to one.
 */
export const dataExport: Job = async ({ db, tenantId, log, params }) => {
  let q = db.from("exports").select("id, tenant_id").eq("status", "queued").order("created_at").limit(5);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  if (params.export) q = q.eq("id", params.export);
  const { data: queued, error } = await q;
  if (error) throw new Error(`exports: ${error.message}`);
  const { data: tables, error: tErr } = await db.rpc("export_table_names");
  if (tErr) throw new Error(`export_table_names: ${tErr.message}`);

  let done = 0;
  for (const ex of queued ?? []) {
    await db.from("exports").update({ status: "running" }).eq("id", ex.id);
    try {
      const files: Record<string, Uint8Array> = {};
      const counts: Record<string, number> = {};
      const { data: tenant } = await db.from("tenants").select("*").eq("id", ex.tenant_id).single();
      files["tenant.json"] = strToU8(JSON.stringify(tenant, null, 2));
      for (const { table_name: table } of tables ?? []) {
        const rows: Record<string, unknown>[] = [];
        for (let from = 0; ; from += PAGE) {
          // Table names come from the catalogue (export_table_names), not user input.
          const { data, error: e } = await db.from(table as "people").select("*").eq("tenant_id", ex.tenant_id).order("created_at").range(from, from + PAGE - 1);
          if (e) throw new Error(`${table}: ${e.message}`);
          rows.push(...((data ?? []) as Record<string, unknown>[]));
          if (!data || data.length < PAGE) break;
        }
        for (const r of rows) for (const k of Object.keys(r)) if (REDACT.has(k)) r[k] = "[redacted]";
        counts[table] = rows.length;
        files[`${table}.json`] = strToU8(JSON.stringify(rows));
      }
      files["README.txt"] = strToU8(`KoryoGraph export for ${tenant?.name ?? ex.tenant_id}\nCreated ${new Date().toISOString()}\nOne JSON array per table. Hashes and secrets are redacted.\n`);
      const zip = zipSync(files, { level: 6 });
      const path = `${ex.tenant_id}/exports/${ex.id}.zip`;
      const { error: upErr } = await db.storage.from("tenant-media").upload(path, zip, { contentType: "application/zip", upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);
      await db.from("exports").update({ status: "ready", file_path: path, stats: counts, expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() }).eq("id", ex.id);
      done++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ export: ex.id, err: message }, "export failed");
      await db.from("exports").update({ status: "failed", error: message }).eq("id", ex.id);
    }
  }
  return { exports: done };
};
