import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { getOptionalCtx, landingPath } from "@/server/context";
import { loadPricing } from "@/server/queries/pricing";

export const metadata = { title: "Start your school" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const ctx = await getOptionalCtx();
  const { plan: raw } = await searchParams;
  const { plans } = await loadPricing();
  const chosen = raw === "custom" ? { key: "custom", name: "Custom (modules you picked)" } : plans.find((p) => p.key === raw);
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
      <SignupForm plan={chosen?.key} planName={chosen?.name} />
    </AuthCard>
  );
}
