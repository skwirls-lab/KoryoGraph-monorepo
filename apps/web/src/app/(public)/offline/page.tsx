export const metadata = { title: "Offline" };
export const dynamic = "force-static";

/** Shown by the Home service worker when there's no connection (no school data is stored offline). */
export default function Offline() {
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">You&apos;re offline</h1>
        <p className="text-fg-secondary">KoryoGraph needs a connection to show your schedule, progress and messages. Try again when you&apos;re back online.</p>
        <a href="/home" className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground no-underline">Try again</a>
      </div>
    </main>
  );
}
