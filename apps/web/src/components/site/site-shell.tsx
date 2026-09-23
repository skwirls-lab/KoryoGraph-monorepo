import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { getOptionalCtx } from "@/server/context";

const NAV = [{ href: "/features", label: "Features" }, { href: "/pricing", label: "Pricing" }, { href: "/contact", label: "Contact" }];
const FOOTER = [
  { title: "Product", links: [{ href: "/features", label: "Features" }, { href: "/pricing", label: "Pricing" }, { href: "/signup", label: "Start a free trial" }] },
  { title: "Company", links: [{ href: "/contact", label: "Contact" }, { href: "/login", label: "Sign in" }] },
  { title: "Legal", links: [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }] },
];

/** Header + footer for the public marketing pages. */
export async function SiteShell({ children }: { children: ReactNode }) {
  const ctx = await getOptionalCtx();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <header className="border-b border-default bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-display text-lg font-bold text-fg no-underline" aria-label="KoryoGraph home">Koryo<span className="text-brand-text">Graph</span></Link>
          <nav aria-label="Main" className="order-3 flex w-full gap-5 text-sm sm:order-none sm:w-auto">
            {NAV.map((n) => <Link key={n.href} href={n.href} className="text-fg-secondary no-underline hover:text-fg">{n.label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {ctx ? <Button asChild size="sm"><Link href="/auth/landing">Go to your workspace</Link></Button> : (
              <>
                <Button asChild size="sm" variant="ghost"><Link href="/login">Sign in</Link></Button>
                <Button asChild size="sm"><Link href="/signup">Start free trial</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-default bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-4">
          <div className="space-y-2">
            <p className="font-display font-bold">Koryo<span className="text-brand-text">Graph</span></p>
            <p className="text-sm text-fg-secondary">Software for martial arts schools: front desk, mat and family app in one place.</p>
          </div>
          {FOOTER.map((g) => (
            <nav key={g.title} aria-label={g.title} className="space-y-2 text-sm">
              <h2 className="font-semibold">{g.title}</h2>
              <ul className="space-y-1">{g.links.map((l) => <li key={l.href}><Link href={l.href} className="text-fg-secondary no-underline hover:text-fg">{l.label}</Link></li>)}</ul>
            </nav>
          ))}
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-fg-muted">© {new Date().getFullYear()} KoryoGraph. Prototype build.</p>
      </footer>
    </div>
  );
}
