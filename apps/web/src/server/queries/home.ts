import "server-only";
import type { Ctx } from "../context";

/** Students in the signed-in member's households (RLS limits people to their own households). */
export async function householdStudents(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("people")
    .select("id, first_name, last_name, preferred_name, dob, type_flags, user_id")
    .contains("type_flags", ["student"])
    .is("archived_at", null)
    .order("dob", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`householdStudents: ${error.message}`);
  return data ?? [];
}
