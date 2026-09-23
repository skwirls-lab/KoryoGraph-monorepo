import { z } from "zod";

/** F1.4 onboarding wizard. Each step is done when the real data exists (or the owner skips it). */
export const ONBOARDING_STEPS = [
  { key: "location", title: "Your location", description: "Address and phone for your school." },
  { key: "programs", title: "Programs and ranks", description: "Start from a Taekwondo, Karate, BJJ or Kickboxing ladder." },
  { key: "schedule", title: "Class schedule", description: "Add your weekly classes." },
  { key: "students", title: "Students", description: "Import from a spreadsheet or add a family." },
  { key: "payments", title: "Payments", description: "Connect Stripe to take card payments into your own account." },
  { key: "staff", title: "Staff", description: "Invite your front desk and instructors." },
  { key: "branding", title: "Branding", description: "Your logo and the app's look." },
  { key: "golive", title: "Go live", description: "Choose your plan when the trial ends." },
] as const satisfies readonly { key: string; title: string; description: string }[];

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export const onboardingState = z
  .object({
    steps: z.record(z.string(), z.boolean()).default({}),
    dismissed: z.boolean().default(false),
  })
  .catch({ steps: {}, dismissed: false });

export function onboardingProgress(steps: Record<string, boolean>): { done: number; total: number } {
  const total = ONBOARDING_STEPS.length;
  const done = ONBOARDING_STEPS.filter((s) => steps[s.key]).length;
  return { done, total };
}
