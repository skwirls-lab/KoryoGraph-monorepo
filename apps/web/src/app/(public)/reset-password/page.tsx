import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getOptionalCtx } from "@/server/context";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The emailed link signs the user in (code exchange) before landing here.
  const ctx = await getOptionalCtx();
  if (!ctx) redirect("/forgot-password");
  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
