import "server-only";
import type { Ctx } from "../context";

export interface StaffRow { userId: string; name: string; email: string | null; role: string; roleKey: string; title: string | null; clockedInAt: string | null; openEntryId: string | null; hasPin: boolean }

/** Active staff (every non-family role) with title, clock state and PIN state. */
export async function staffList(ctx: Ctx): Promise<StaffRow[]> {
  const [{ data: users }, { data: profiles }, { data: open }, { data: pins }] = await Promise.all([
    ctx.supabase.from("tenant_users").select("user_id, roles(key, name, surface), profiles(full_name, email)").eq("status", "active"),
    ctx.supabase.from("staff_profiles").select("user_id, title"),
    ctx.supabase.from("time_entries").select("id, user_id, clock_in").is("clock_out", null),
    ctx.supabase.from("staff_pins").select("user_id"),
  ]);
  return (users ?? []).filter((u) => u.roles && u.roles.surface !== "home").map((u) => {
    const e = (open ?? []).find((x) => x.user_id === u.user_id);
    return {
      userId: u.user_id, name: u.profiles?.full_name || u.profiles?.email || "Staff", email: u.profiles?.email ?? null,
      role: u.roles?.name ?? "", roleKey: u.roles?.key ?? "", title: (profiles ?? []).find((p) => p.user_id === u.user_id)?.title ?? null,
      clockedInAt: e?.clock_in ?? null, openEntryId: e?.id ?? null, hasPin: (pins ?? []).some((p) => p.user_id === u.user_id),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
