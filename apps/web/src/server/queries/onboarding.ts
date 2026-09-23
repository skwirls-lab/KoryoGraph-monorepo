import "server-only";
import { ONBOARDING_STEPS, onboardingState, type OnboardingStepKey } from "@/lib/onboarding";
import type { Ctx } from "../context";

export interface StepStatus { key: OnboardingStepKey; done: boolean; skipped: boolean; detail: string }

/** Each step's status from the school's real data; a skipped step counts as done (and says so). */
export async function onboardingStatus(ctx: Ctx): Promise<{ steps: StepStatus[]; done: number; total: number; live: boolean; planChoice: string | null; status: string; trialEndsAt: string | null }> {
  const [{ data: t }, { data: loc }, { data: programs }, { count: classes }, { count: students }, { data: members }] = await Promise.all([
    ctx.supabase.from("tenants").select("status, trial_ends_at, onboarding, branding, settings, stripe_onboarding_complete").eq("id", ctx.tenantId as string).single(),
    ctx.supabase.from("locations").select("address, phone").eq("is_default", true).maybeSingle(),
    ctx.supabase.from("programs").select("id, ranks(count)").eq("active", true),
    ctx.supabase.from("class_templates").select("id", { count: "exact", head: true }).eq("active", true),
    ctx.supabase.from("people").select("id", { count: "exact", head: true }).contains("type_flags", ["student"]).is("archived_at", null),
    ctx.supabase.from("tenant_users").select("status, roles(surface)"),
  ]);
  const flags = onboardingState.parse(t?.onboarding ?? {}).steps;
  const addr = (loc?.address ?? {}) as Record<string, string | undefined>;
  const rankCount = (programs ?? []).reduce((n, p) => n + ((p.ranks as unknown as { count: number }[])?.[0]?.count ?? 0), 0);
  const staff = (members ?? []).filter((m) => m.roles?.surface !== "home");
  const branding = (t?.branding ?? {}) as { logo_path?: string; theme?: string; saved_at?: string };
  const live = t?.status === "active";
  const real: Record<OnboardingStepKey, [boolean, string]> = {
    location: [Boolean(addr.line1 && addr.city), addr.line1 ? `${addr.line1}, ${addr.city ?? ""}` : "No address yet"],
    programs: [rankCount > 0, `${programs?.length ?? 0} program${programs?.length === 1 ? "" : "s"}, ${rankCount} ranks`],
    schedule: [(classes ?? 0) > 0, `${classes ?? 0} weekly class${classes === 1 ? "" : "es"}`],
    students: [(students ?? 0) > 0, `${students ?? 0} student${students === 1 ? "" : "s"}`],
    payments: [Boolean(t?.stripe_onboarding_complete), t?.stripe_onboarding_complete ? "Stripe connected" : "Not connected"],
    staff: [staff.length > 1, `${staff.filter((s) => s.status === "active").length} active, ${staff.filter((s) => s.status === "invited").length} invited`],
    branding: [Boolean(branding.saved_at), branding.logo_path ? "Logo uploaded" : branding.saved_at ? "Theme chosen" : "Default look"],
    golive: [live, live ? "Live" : t?.trial_ends_at ? "On trial" : "Not live"],
  };
  const steps = ONBOARDING_STEPS.map((s) => {
    const [done, detail] = real[s.key];
    const skipped = !done && s.key !== "golive" && Boolean(flags[s.key]);
    return { key: s.key, done: done || skipped, skipped, detail };
  });
  return {
    steps, done: steps.filter((s) => s.done).length, total: steps.length, live, status: t?.status ?? "trial", trialEndsAt: t?.trial_ends_at ?? null,
    planChoice: ((t?.settings ?? {}) as { plan_choice?: string }).plan_choice ?? null,
  };
}
