import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" description="We'll email you a link to choose a new one." footer={<Link href="/login">Back to sign in</Link>}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
