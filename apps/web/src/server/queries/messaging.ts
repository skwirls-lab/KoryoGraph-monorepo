import "server-only";
import type { Ctx } from "../context";

export async function unreadThreadCount(ctx: Ctx): Promise<number> {
  if (!ctx.permissions.has("comms.send")) return 0;
  const { count } = await ctx.supabase.from("message_threads").select("id", { count: "exact", head: true }).gt("unread_staff", 0).eq("status", "open");
  return count ?? 0;
}

export async function listThreads(ctx: Ctx, f: { status?: "open" | "closed"; mine?: boolean }) {
  let q = ctx.supabase.from("message_threads").select("id, subject, last_message_at, unread_staff, unread_household, status, assigned_user_id, households(id, name)").order("last_message_at", { ascending: false }).limit(200);
  if (f.status) q = q.eq("status", f.status);
  if (f.mine) q = q.eq("assigned_user_id", ctx.userId);
  const { data, error } = await q;
  if (error) throw new Error(`listThreads: ${error.message}`);
  return data ?? [];
}

export async function getThread(ctx: Ctx, id: string) {
  const { data: thread } = await ctx.supabase.from("message_threads").select("*, households(id, name)").eq("id", id).maybeSingle();
  if (!thread) return null;
  const { data: messages } = await ctx.supabase
    .from("thread_messages")
    .select("id, body, from_staff, created_at, sender_user_id, sender_person_id, people(first_name, last_name, preferred_name)")
    .eq("thread_id", id)
    .order("created_at");
  const staffIds = [...new Set((messages ?? []).filter((m) => m.from_staff && m.sender_user_id).map((m) => m.sender_user_id as string))];
  const { data: staff } = staffIds.length ? await ctx.supabase.from("profiles").select("id, full_name").in("id", staffIds) : { data: [] };
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.full_name ?? "Staff"]));
  return {
    thread,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      fromStaff: m.from_staff,
      at: m.created_at,
      author: m.from_staff ? staffName.get(m.sender_user_id ?? "") ?? "Staff" : m.people ? `${m.people.preferred_name || m.people.first_name} ${m.people.last_name}` : "Family",
    })),
  };
}

export async function listOutbox(ctx: Ctx, f: { status?: string; channel?: string }) {
  let q = ctx.supabase
    .from("communications")
    .select("id, channel, direction, status, to_address, subject, body_text, template_key, error, created_at, sent_at, scheduled_for, people(first_name, last_name)")
    .eq("direction", "out")
    .order("created_at", { ascending: false })
    .limit(200);
  if (f.status) q = q.eq("status", f.status);
  if (f.channel) q = q.eq("channel", f.channel);
  const { data, error } = await q;
  if (error) throw new Error(`listOutbox: ${error.message}`);
  return data ?? [];
}
