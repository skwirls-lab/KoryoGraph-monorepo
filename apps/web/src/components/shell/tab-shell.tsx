"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@koryo/ui/lib/utils";
import type { ResolvedNavItem } from "@/lib/nav";
import { NavIcon } from "./nav-icon";
import { UserMenu } from "./user-menu";

/** Mobile-first shell with a bottom tab bar (Mat and Home). Tap targets ≥ 48px. */
export function TabShell({
  surface, title, nav, user, headerExtra, children,
}: {
  surface: "mat" | "home";
  title: string;
  nav: ResolvedNavItem[];
  user: { name: string; email: string | null; role: string | null };
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const root = `/${surface}`;
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-default bg-background/90 px-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display font-bold">{title}</div>
        </div>
        {headerExtra}
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        {children}
      </main>
      <nav aria-label={surface === "mat" ? "Mat" : "Home"} className="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-surface pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-3xl">
          {nav.map((item) => {
            const active = item.href === root ? pathname === root : pathname.startsWith(item.href);
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.locked ? `${root}` : item.href}
                  aria-current={active ? "page" : undefined}
                  aria-disabled={item.locked || undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-medium text-fg-secondary no-underline sm:text-xs",
                    active && "text-brand-text",
                    item.locked && "opacity-50",
                  )}
                >
                  <NavIcon icon={item.icon} className="size-5" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
