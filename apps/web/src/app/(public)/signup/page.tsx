import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { getOptionalCtx, landingPath } from "@/server/context";

export const metadata = { title: "Start your school" };

export default async function SignupPage() {
  const ctx = await getOptionalCtx();
  if (ctx) redirect(ctx.tenantId ? landingPath(ctx) : "/welcome");
  return (
    <AuthCard
      title="Start your school"
      description="14 days with every module. No card needed."
      footer={
        <>
          Already have an account? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
