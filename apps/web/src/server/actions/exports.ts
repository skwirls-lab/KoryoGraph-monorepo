"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCtx } from "../context";
import { authorize } from "../lib/authorize";
import { logger } from "../log";

/**
 * Request a full data export (exports.run). The ZIP is built by the data_export job; we trigger it right
 * away through the job route (Bearer CRON_SECRET) so the file is usually ready when the page reloads.
 */
export async function requestExport(): Promise<ActionResult<{ status: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "exports.run" });
  if (denied) return denied;
  const { data, error } = await ctx.supabase.from("exports").insert({ tenant_id: ctx.tenantId as string, kind: "full", by_user_id: ctx.userId }).select("id").single();
  if (error || !data) return fail("Couldn't start the export.");
  await ctx.supabase.rpc("audit_export", { p_entity: "full_tenant", p_rows: 0 });
  let status = "queued";
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
    const res = await fetch(`${base}/api/jobs/data_export?tenant=${ctx.tenantId}&export=${data.id}`, {
      method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
    });
    if (res.ok) status = "ready";
  } catch (err) {
    logger(ctx).warn({ err: err instanceof Error ? err.message : String(err) }, "export trigger failed; the scheduled job will pick it up");
  }
  revalidatePath("/desk/settings/export");
  return ok({ status });
}
