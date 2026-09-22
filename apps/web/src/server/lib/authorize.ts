import "server-only";
import { fail } from "@/lib/action-result";
import { AuthzError, requireModule, requirePermission, type Ctx } from "../context";

/**
 * For server actions: returns a failed ActionResult instead of throwing when the user lacks a permission
 * or module, so forms can show the reason. Usage:
 *   const denied = authorize(ctx, { permission: "people.write" }); if (denied) return denied;
 */
export function authorize(ctx: Ctx, need: { permission?: string | string[]; module?: string }): ReturnType<typeof fail> | null {
  try {
    if (need.module) requireModule(ctx, need.module);
    for (const p of [need.permission ?? []].flat()) requirePermission(ctx, p);
    return null;
  } catch (err) {
    if (err instanceof AuthzError) return fail(err.code === "module_locked" ? err.message : "You don't have permission to do that.");
    throw err;
  }
}
