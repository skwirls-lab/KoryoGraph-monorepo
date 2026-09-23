import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@koryo/db/types";

/** Remember the plan picked on the public site (tenants.settings.plan_choice) so "Go live" can preselect it. */
export async function rememberPlanChoice(supabase: SupabaseClient<Database>, tenantId: string, plan: string): Promise<void> {
  const { data: t } = await supabase.from("tenants").select("settings").eq("id", tenantId).single();
  const settings = (t?.settings ?? {}) as Record<string, unknown>;
  await supabase.from("tenants").update({ settings: { ...settings, plan_choice: plan } as Json }).eq("id", tenantId);
}
