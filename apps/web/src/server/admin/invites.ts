import "server-only";
import { createServiceClient } from "@koryo/db/service";
import type { Ctx } from "../context";

export const STAFF_ROLE_KEYS = ["admin", "front_desk", "instructor", "assistant_instructor"] as const;

/**
 * Invite a staff member (caller already checked for staff.manage). The auth user is created — and the invite
 * email sent — by Supabase Auth (it uses the project's SMTP settings; locally, Mailpit). The membership row
 * waits as 'invited' until they sign in and accept on /welcome. Needs the service role to create users.
 */
export async function inviteStaffMember(ctx: Ctx, input: { email: string; name: string; roleKey: (typeof STAFF_ROLE_KEYS)[number]; redirectTo: string }): Promise<{ ok: true; existingUser: boolean } | { ok: false; error: string }> {
  const tenantId = ctx.tenantId as string;
  const { data: role } = await ctx.supabase.from("roles").select("id").eq("key", input.roleKey).maybeSingle();
  if (!role) return { ok: false, error: "That role doesn't exist in your school." };
  const admin = createServiceClient();
  const email = input.email.trim().toLowerCase();
  let userId: string | null = null;
  let existingUser = false;
  const { data: found } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (found) {
    userId = found.id;
    existingUser = true;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: input.name }, redirectTo: input.redirectTo });
    if (error || !data.user) return { ok: false, error: error?.status === 429 ? "Too many invitations just now; try again in a minute." : "The invitation email couldn't be sent." };
    userId = data.user.id;
  }
  const { data: member } = await admin.from("tenant_users").select("status").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
  if (member?.status === "active") return { ok: false, error: "They're already on your team." };
  const { error } = member
    ? await admin.from("tenant_users").update({ status: "invited", role_id: role.id, invited_email: email, invited_by: ctx.userId }).eq("tenant_id", tenantId).eq("user_id", userId)
    : await admin.from("tenant_users").insert({ tenant_id: tenantId, user_id: userId, role_id: role.id, status: "invited", invited_email: email, invited_by: ctx.userId });
  if (error) return { ok: false, error: "Couldn't record the invitation." };
  const { error: auditError } = await admin.from("audit_events").insert({ tenant_id: tenantId, actor_user_id: ctx.userId, action: "custom", note: "invite_staff", entity_type: "tenant_user", after: { email, role: input.roleKey } });
  if (auditError) return { ok: false, error: "The invitation was sent but couldn't be recorded in the audit log." };
  return { ok: true, existingUser };
}
