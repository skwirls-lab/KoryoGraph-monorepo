"use server";

import { redirect } from "next/navigation";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { safeNext } from "@/lib/surfaces";
import { rememberPlanChoice } from "../lib/plan-choice";
import {
  forgotPasswordSchema,
  loginSchema,
  magicLinkSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type MagicLinkInput,
  type ResetPasswordInput,
} from "@/lib/validation/auth";
import { signupSchema, type SignupInput } from "@/lib/validation/signup";
import { logger } from "../log";
import { supabaseServer } from "../supabase";

// Authentication actions run before a session exists, so they live outside src/server/actions/**
// (whose functions must start with getCtx()).

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
}

function callbackUrl(next?: string): string {
  const u = new URL("/auth/callback", appUrl());
  if (next) u.searchParams.set("next", safeNext(next));
  return u.toString();
}

export async function signInWithPassword(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    logger().info({ reason: error.code }, "sign-in failed");
    return fail("That email and password don't match an account.");
  }
  redirect(parsed.data.next ? safeNext(parsed.data.next) : "/auth/landing");
}

export async function sendMagicLink(input: MagicLinkInput): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(parsed.data.next) },
  });
  // Don't reveal whether the account exists; log the real outcome.
  if (error) logger().info({ reason: error.code }, "magic link not sent");
  return ok();
}

export async function signInWithGoogle(next?: string): Promise<ActionResult> {
  if (!process.env.SUPABASE_AUTH_GOOGLE_CLIENT_ID) return fail("Google sign-in isn't configured for this deployment.");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) return fail("Couldn't start Google sign-in. Try again or use email.");
  redirect(data.url);
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl("/reset-password"),
  });
  if (error) logger().info({ reason: error.code }, "password reset email not sent");
  return ok();
}

export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return fail("Your reset link has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);
  redirect("/auth/landing");
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * F1.3 self-serve signup: create the account, then the school. When email confirmation is required the
 * school details wait in user metadata and /welcome offers to finish after the user confirms.
 */
export async function signUpWithSchool(input: SignupInput): Promise<ActionResult<{ confirmEmail: boolean }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const { email, password, fullName, schoolName, timezone, plan } = parsed.data;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, pending_school: { name: schoolName, timezone, plan: plan ?? null } },
      emailRedirectTo: callbackUrl("/welcome"),
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("An account with that email already exists. Sign in instead.", { email: "Already registered" });
    if (error.code === "weak_password") return fail(error.message, { password: error.message });
    logger().error({ reason: error.code }, "sign-up failed");
    return fail("We couldn't create your account. Please try again.");
  }
  if (!data.session) return ok({ confirmEmail: true });

  const { data: tenantId, error: tenantError } = await supabase.rpc("create_tenant", { p_name: schoolName, p_slug: "", p_timezone: timezone });
  if (tenantError || !tenantId) {
    logger({ userId: data.user?.id }).error({ err: tenantError?.message }, "create_tenant after sign-up failed");
    redirect("/welcome");
  }
  await supabase.auth.updateUser({ data: { pending_school: null } });
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) redirect("/login?next=/desk/onboarding");
  if (plan) await rememberPlanChoice(supabase, tenantId, plan);
  redirect("/desk/onboarding");
}

