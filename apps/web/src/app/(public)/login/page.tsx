import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/surfaces";
import { getOptionalCtx, landingPath } from "@/server/context";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link_expired: "That link has expired or was already used. Request a new one.",
  invalid_link: "That link isn't valid.",
  missing_code: "That sign-in link is incomplete.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const ctx = await getOptionalCtx();
  if (ctx) redirect(next ? safeNext(next) : landingPath(ctx));
  return (
    <AuthCard
      title="Sign in"
      description="Welcome back to your school."
      footer={
        <>
          New to KoryoGraph? <Link href="/signup">Start your school</Link>
        </>
      }
    >
      {error && ERRORS[error] ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {ERRORS[error]}
        </p>
      ) : null}
      <LoginForm next={next ? safeNext(next) : undefined} googleEnabled={Boolean(process.env.SUPABASE_AUTH_GOOGLE_CLIENT_ID)} />
    </AuthCard>
  );
}
