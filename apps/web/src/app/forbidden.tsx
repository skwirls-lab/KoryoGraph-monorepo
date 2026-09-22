import Link from "next/link";

export const metadata = { title: "Not allowed" };

export default function Forbidden() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="max-w-md space-y-3 text-center">
        <p className="font-display text-5xl font-bold text-brand-text">403</p>
        <h1 className="text-2xl font-bold">You don&apos;t have access to this area</h1>
        <p className="text-sm text-fg-secondary">Your role in this school doesn&apos;t include this surface. Ask the school owner if you think that&apos;s wrong.</p>
        <p>
          <Link href="/auth/landing">Go to your workspace</Link>
        </p>
      </section>
    </main>
  );
}
