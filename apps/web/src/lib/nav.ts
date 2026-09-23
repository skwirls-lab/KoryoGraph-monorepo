/** Navigation per surface. Items gate on permission (hidden) and module (shown locked → upgrade). */
export const ICONS = [
  "dashboard", "rocket", "users", "calendar", "award", "book", "credit-card", "shopping-bag", "megaphone",
  "party", "inbox", "chart", "settings", "check-square", "home", "message", "trending-up", "wallet", "sparkles", "clipboard",
] as const;
export type IconKey = (typeof ICONS)[number];

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  permission?: string;
  module?: string;
}

export interface ResolvedNavItem {
  href: string;
  label: string;
  icon: IconKey;
  locked: boolean;
  module?: string;
  badge?: number;
}

export const DESK_NAV: NavItem[] = [
  { href: "/desk", label: "Dashboard", icon: "dashboard", permission: "desk.access" },
  { href: "/desk/people", label: "People", icon: "users", permission: "people.read" },
  { href: "/desk/schedule", label: "Schedule", icon: "calendar", permission: "desk.access" },
  { href: "/desk/programs", label: "Programs", icon: "award", permission: "desk.access" },
  { href: "/desk/curriculum", label: "Curriculum", icon: "book", permission: "desk.access" },
  { href: "/desk/crm", label: "Pipeline", icon: "trending-up", permission: "crm.manage", module: "grow" },
  { href: "/desk/testing", label: "Testing", icon: "check-square", permission: "testing.manage" },
  { href: "/desk/billing", label: "Billing", icon: "credit-card", permission: "billing.read", module: "billing" },
  { href: "/desk/retail", label: "Retail", icon: "shopping-bag", permission: "retail.sell", module: "retail" },
  { href: "/desk/inbox", label: "Inbox", icon: "inbox", permission: "comms.send" },
  { href: "/desk/reports", label: "Reports", icon: "chart", permission: "reports.read" },
  { href: "/desk/documents", label: "Documents", icon: "clipboard", permission: "people.read" },
  { href: "/desk/onboarding", label: "Get started", icon: "rocket", permission: "settings.manage" },
  { href: "/desk/settings", label: "Settings", icon: "settings", permission: "desk.access" },
];

export const MAT_NAV: NavItem[] = [
  { href: "/mat", label: "Today", icon: "calendar", permission: "mat.access" },
  { href: "/mat/students", label: "Students", icon: "users", permission: "mat.access" },
  { href: "/mat/schedule", label: "Schedule", icon: "clipboard", permission: "mat.access" },
  { href: "/mat/testing", label: "Testing", icon: "check-square", permission: "testing.manage" },
];

export const HOME_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: "home", permission: "home.access" },
  { href: "/home/schedule", label: "Schedule", icon: "calendar", permission: "home.access" },
  { href: "/home/progress", label: "Progress", icon: "trending-up", permission: "home.access" },
  { href: "/home/billing", label: "Billing", icon: "wallet", permission: "home.access", module: "billing" },
  { href: "/home/messages", label: "Messages", icon: "message", permission: "home.access" },
  { href: "/home/documents", label: "Forms", icon: "clipboard", permission: "home.access" },
];

export function resolveNav(
  items: readonly NavItem[],
  permissions: ReadonlySet<string>,
  modules: ReadonlySet<string>,
  badges: Record<string, number> = {},
): ResolvedNavItem[] {
  return items
    .filter((i) => !i.permission || permissions.has(i.permission))
    .map((i) => ({
      href: i.href, label: i.label, icon: i.icon, module: i.module, locked: Boolean(i.module && !modules.has(i.module)),
      ...(badges[i.href] ? { badge: badges[i.href] } : {}),
    }));
}
