import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthCard } from "@/components/auth/auth-card";
import { Invitations } from "@/components/auth/invitations";
import { SchoolForm } from "@/components/auth/school-form";
import { getOptionalCtx, landingPath } from "@/server/context";

export const metadata = { title: "Welcome" };

const pendingSchool = z.object({ name: z.string(), timezone: z.string(), plan: z.string().nullish() });

/** Signed in but not (yet) a member of any school: create one, or wait for an invitation. */
export default async function WelcomePage() {
  const ctx = await getOptionalCtx();
  if (!ctx) redirect("/login");
  if (ctx.tenantId) redirect(landingPath(ctx));
  const { data } = await ctx.supabase.auth.getUser();
  const pending = pendingSchool.safeParse(data.user?.user_metadata?.pending_school);
  const { data: invites } = await ctx.supabase.rpc("my_invitations");
  if (invites?.length && !pending.success) {
    return (
      <AuthCard title="You've been invited" description="Accept to join your school's team.">
        <Invitations invites={invites.map((i) => ({ id: i.tenant_user_id ?? "", school: i.tenant_name ?? "A school", role: i.role_name ?? "staff" }))} />
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={pending.success ? "Finish setting up your school" : "Create your school"}
      description={pending.success ? "Your email is confirmed. One click and you're in." : "Your account isn't connected to a school yet. Joining one? Ask your school for an invitation instead."}
      footer={
        <form action="/auth/signout" method="post">
          <button type="submit" className="underline">Sign out</button>
        </form>
      }
    >
      <SchoolForm defaultName={pending.success ? pending.data.name : ""} defaultTimezone={pending.success ? pending.data.timezone : ""} plan={pending.success ? pending.data.plan ?? undefined : undefined} />
    </AuthCard>
  );
}
