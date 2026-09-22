import Link from "next/link";
import { Button } from "@koryo/ui/components/ui/button";
import { getOptionalCtx } from "@/server/context";

// The full marketing site is rebuilt in M5.01; this is the honest minimum: what it is and how to get in.
export default async function PublicHome() {
  const ctx = await getOptionalCtx();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-4">
        <p className="font-display text-xl font-bold">
          Koryo<span className="text-brand-text">Graph</span>
        </p>
        <h1 className="text-4xl font-bold sm:text-5xl">The operating system for martial arts schools.</h1>
        <p className="max-w-prose text-lg text-fg-secondary">
          One place for your front desk, your instructors on the mat, and the families you teach.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {ctx ? (
          <Button asChild size="lg">
            <Link href="/auth/landing">Go to your workspace</Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/signup">Start your school</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
