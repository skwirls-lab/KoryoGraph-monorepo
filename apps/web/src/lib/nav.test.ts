import { describe, expect, it } from "vitest";
import { resolveNav, type NavItem } from "./nav";

const items: NavItem[] = [
  { href: "/a", label: "A", icon: "dashboard", permission: "x.read" },
  { href: "/b", label: "B", icon: "wallet", permission: "x.read", module: "billing" },
  { href: "/c", label: "C", icon: "users", permission: "y.read" },
];

describe("resolveNav", () => {
  it("hides items without permission and locks items without the module", () => {
    expect(resolveNav(items, new Set(["x.read"]), new Set(["core"]))).toEqual([
      { href: "/a", label: "A", icon: "dashboard", module: undefined, locked: false },
      { href: "/b", label: "B", icon: "wallet", module: "billing", locked: true },
    ]);
  });
  it("unlocks licensed modules", () => {
    expect(resolveNav(items, new Set(["x.read"]), new Set(["billing"]))[1]?.locked).toBe(false);
  });
});
