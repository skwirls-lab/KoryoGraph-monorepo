"use client";

import Link from "next/link";
import { Button } from "@koryo/ui/components/ui/button";
import { Skeleton } from "@koryo/ui/components/ui/skeleton";

/** Route-level loading skeleton: a header and a list, so the layout doesn't jump when data arrives. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="space-y-2 rounded-xl border border-default bg-surface p-4">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Route-level error boundary body: plain words, a retry, and the digest to quote to support (the server logs the error under it). */
export function PageError({ error, reset, home }: { error: Error & { digest?: string }; reset: () => void; home: string }) {
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-3 rounded-xl border border-default bg-surface p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-fg-secondary">This page couldn&apos;t load. Nothing was changed. Try again, and if it keeps happening, tell us the reference below.</p>
      {error.digest ? <p className="font-mono text-xs text-fg-muted">Reference: {error.digest}</p> : null}
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline"><Link href={home}>Go to the start</Link></Button>
      </div>
    </div>
  );
}
