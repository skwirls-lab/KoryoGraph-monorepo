import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="font-display text-xl font-bold text-fg no-underline">
          Koryo<span className="text-brand-text">Graph</span>
        </Link>
        <section className="space-y-6 rounded-2xl border border-default bg-surface p-6 shadow-kg-md sm:p-8">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold">{title}</h1>
            {description ? <p className="text-sm text-fg-secondary">{description}</p> : null}
          </header>
          {children}
        </section>
        {footer ? <div className="text-center text-sm text-fg-secondary">{footer}</div> : null}
      </div>
    </main>
  );
}
