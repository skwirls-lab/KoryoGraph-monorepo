import { aiFromEnv, type Ai, type AiStore } from "@koryo/ai";
import type { ServiceClient } from "@koryo/db/service";
import { FIXTURES_DIR, row } from "../ai";

/** Store for jobs (service role): writes ai_runs directly for the given tenant. */
export function serviceStore(db: ServiceClient): AiStore {
  return {
    async budget(tenantId) {
      const { data } = await db.rpc("ai_budget_status_for", { p_tenant: tenantId });
      const b = data?.[0];
      return b ? { limitCents: b.limit_cents, usedCents: Number(b.used_cents) } : null;
    },
    async price(model) {
      const { data } = await db.from("ai_models").select("input_per_m_cents, output_per_m_cents").eq("id", model).maybeSingle();
      return data ? { inputPerM: Number(data.input_per_m_cents), outputPerM: Number(data.output_per_m_cents) } : null;
    },
    async logRun(r) {
      const { data } = await db.from("ai_runs").insert({ ...row(r), tenant_id: r.tenantId, user_id: r.userId }).select("id").single();
      return data?.id ?? null;
    },
  };
}

export function aiForJob(db: ServiceClient): Ai {
  return aiFromEnv(process.env, serviceStore(db), { fixturesDir: FIXTURES_DIR });
}
