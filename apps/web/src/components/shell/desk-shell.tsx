"use client";

import { Inbox, Lock, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@koryo/ui/components/ui/command";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@koryo/ui/components/ui/sheet";
import { cn } from "@koryo/ui/lib/utils";
import type { ResolvedNavItem } from "@/lib/nav";
import { NavIcon } from "./nav-icon";
import { TenantSwitcher, type TenantOption } from "./tenant-switcher";
import { UserMenu } from "./user-menu";

export interface DeskShellProps {
  nav: ResolvedNavItem[];
  tenant: TenantOption;
  tenants: TenantOption[];
  user: { name: string; email: string | null; role: string | null };
  /** Pending approval items (AI drafts waiting for a person). */
  approvals?: number;
  children: ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/desk" ? pathname === "/desk" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ nav, pathname, onNavigate }: { nav: ResolvedNavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Desk">
      <ul className="space-y-0.5">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const href = item.locked ? `/desk/upgrade?module=${item.module ?? ""}` : item.href;
          return (
            <li key={item.href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-fg-secondary no-underline transition-colors hover:bg-elevated hover:text-fg",
                  active && "bg-brand-subtle text-fg",
                )}
              >
                <NavIcon icon={item.icon} className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-brand-foreground tabular" aria-label={`${item.badge} unread`}>{item.badge}</span> : null}
                {item.locked ? <Lock aria-label="Not in your plan" className="size-3.5 text-fg-muted" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DeskShell({ nav, tenant, tenants, user, approvals = 0, children }: DeskShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const copilot = nav.find((i) => i.href === "/desk/copilot" && !i.locked);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const brand = (
    <Link href="/desk" className="font-display text-lg font-bold text-fg no-underline">
      Koryo<span className="text-brand-text">Graph</span>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr] print:block">
      <aside className="hidden border-r border-default bg-panel p-4 lg:flex lg:flex-col lg:gap-6 print:!hidden">
        <div className="px-2 pt-1">{brand}</div>
        <NavList nav={nav} pathname={pathname} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-default bg-background/90 px-3 backdrop-blur sm:px-4 print:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-panel p-4">
              <SheetTitle className="px-2">{brand}</SheetTitle>
              <div className="mt-6">
                <NavList nav={nav} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <TenantSwitcher current={tenant} tenants={tenants} />
          </div>
          <Button variant="outline" size="sm" className="gap-2 text-fg-secondary" onClick={() => setPaletteOpen(true)} aria-label="Search (Ctrl+K)">
            <Search aria-hidden className="size-4" />
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden rounded border border-default px-1.5 text-[10px] md:inline">⌘K</kbd>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/desk/inbox/approvals" aria-label={approvals ? `Approvals, ${approvals} waiting` : "Approvals"} className="relative">
              <Inbox className="size-5" />
              {approvals ? <span aria-hidden className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">{approvals > 99 ? "99+" : approvals}</span> : null}
            </Link>
          </Button>
          <UserMenu name={user.name} email={user.email} role={user.role} />
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title="Go to" description="Jump to a page">
        <CommandInput placeholder={copilot ? "Go to… or ask the copilot" : "Go to…"} value={paletteQuery} onValueChange={setPaletteQuery} />
        <CommandList>
          <CommandEmpty>No matching pages.</CommandEmpty>
          {copilot && paletteQuery.trim().length > 2 ? (
            <CommandGroup heading="Ask">
              <CommandItem value={`ask copilot ${paletteQuery}`} onSelect={() => {
                setPaletteOpen(false);
                router.push(`/desk/copilot?q=${encodeURIComponent(paletteQuery.trim())}`);
                setPaletteQuery("");
              }}>
                <NavIcon icon="bot" className="size-4" />
                Ask Copilot: “{paletteQuery.trim()}”
              </CommandItem>
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Pages">
            {nav.map((item) => (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => {
                  setPaletteOpen(false);
                  router.push(item.locked ? `/desk/upgrade?module=${item.module ?? ""}` : item.href);
                }}
              >
                <NavIcon icon={item.icon} className="size-4" />
                {item.label}
                {item.locked ? <Lock aria-hidden className="ml-auto size-3.5" /> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
