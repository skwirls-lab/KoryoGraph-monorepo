import type { RoleKey } from "./tenant";

/** Login accounts created by every seed profile (documented in docs/build/DEMO-ACCOUNTS.md). */
export const TENANTS = {
  ridgeline: { name: "Ridgeline Taekwondo", slug: "ridgeline", domain: "ridgelinetkd.demo", plan: "academy_ai" },
  harbor: { name: "Harbor BJJ", slug: "harbor", domain: "harborbjj.demo", plan: "core" },
} as const;

export const ROLE_ACCOUNTS: readonly { role: RoleKey; local: string; name: Record<keyof typeof TENANTS, string> }[] = [
  { role: "owner", local: "owner", name: { ridgeline: "Master Alex Kim", harbor: "Professor Dana Reyes" } },
  { role: "admin", local: "admin", name: { ridgeline: "Jordan Lee", harbor: "Sam Ortiz" } },
  { role: "front_desk", local: "frontdesk", name: { ridgeline: "Priya Shah", harbor: "Chris Nolan" } },
  { role: "instructor", local: "instructor", name: { ridgeline: "Sabumnim Grace Park", harbor: "Coach Mateo Silva" } },
  { role: "assistant_instructor", local: "assistant", name: { ridgeline: "Evan Brooks", harbor: "Lena Novak" } },
  { role: "parent", local: "parent", name: { ridgeline: "Morgan Cooper", harbor: "Taylor Quinn" } },
  { role: "student", local: "student", name: { ridgeline: "Riley Adams", harbor: "Jesse Moreno" } },
];

export function accountEmail(tenant: keyof typeof TENANTS, local: string): string {
  return `${local}@${TENANTS[tenant].domain}`;
}

export const PLATFORM_ADMIN_EMAIL = "platform@koryograph.demo";
