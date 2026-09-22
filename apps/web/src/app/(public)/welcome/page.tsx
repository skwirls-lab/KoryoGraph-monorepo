import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { getOptionalCtx, landingPath } from "@/server/context";

export const metadata = { title: "Welcome" };

/** Signed in but not (yet) a member of any school. */
export default async function WelcomePage() {
  const ctx = await getOptionalCtx();
  if (!ctx) redirect("/login");
  if (ctx.tenantId) redirect(landingPath(ctx));
  return (
    <AuthCard title="You're signed in" description="Your account isn't connected to a school yet.">
      <ul className="space-y-3 text-sm">
        <li>
          <strong>Running a school?</strong> <Link href="/signup">Create your school</Link> to start a 14-day trial.
        </li>
        <li>
          <strong>Joining one?</strong> Ask your school to send you an invitation, then open the link in the email.
        </li>
      </ul>
      <form action="/auth/signout" method="post">
        <button type="submit" className="text-sm underline">Sign out</button>
      </form>
    </AuthCard>
  );
}
