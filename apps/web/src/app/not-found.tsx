import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="max-w-md space-y-3 text-center">
        <p className="font-display text-5xl font-bold text-brand-text">404</p>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p>
          <Link href="/">Back to KoryoGraph</Link>
        </p>
      </section>
    </main>
  );
}
