import { rpc } from "@koryo/db";
import type { Job, JobStats } from "./types";

/**
 * After-school pickup cutoff (F9.3). Per tenant with Programs+: children expected today who weren't picked up
 * from school by their program's cutoff are marked absent and their guardians get an alert (queued; the
 * outbox job delivers it). Each child is alerted at most once a day.
 */
export const afterschoolCutoff: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id").eq("module_key", "programs_plus").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const stats: JobStats = { tenants: 0, alerted: 0 };
  for (const e of ents ?? []) {
    const n = Number(await rpc(db, "afterschool_cutoff", { p_tenant_id: e.tenant_id, p_now: nowIso }));
    stats.tenants = Number(stats.tenants) + 1;
    stats.alerted = Number(stats.alerted) + n;
    if (n) log.info({ tenant: e.tenant_id, alerted: n }, "after-school cutoff alerts");
  }
  return stats;
};
