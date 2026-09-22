import { z } from "zod";

/** F1.4 onboarding checklist. `href` is set only once the screen that completes the step exists. */
export const ONBOARDING_STEPS = [
  { key: "location", title: "Add your location", description: "Address, phone and rooms for your school.", href: null, milestone: "M5" },
  { key: "programs", title: "Set up programs and ranks", description: "Programs, belt ladders and requirements.", href: null, milestone: "M1" },
  { key: "schedule", title: "Build your class schedule", description: "Recurring classes with capacity and instructors.", href: null, milestone: "M1" },
  { key: "students", title: "Add or import students", description: "Families, students and guardians.", href: null, milestone: "M1" },
  { key: "payments", title: "Connect Stripe", description: "Take card and ACH payments into your own account.", href: null, milestone: "M2" },
  { key: "staff", title: "Invite your staff", description: "Front desk and instructors with the right roles.", href: null, milestone: "M1" },
  { key: "branding", title: "Brand your school", description: "Logo, accent colour and terminology.", href: null, milestone: "M5" },
] as const satisfies readonly { key: string; title: string; description: string; href: string | null; milestone: string }[];

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
