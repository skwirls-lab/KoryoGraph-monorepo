"use client";

/** Last-resort boundary (the root layout itself failed): no app styles or providers are available here. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <main role="alert" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <p>KoryoGraph couldn&apos;t load. Nothing was changed.</p>
          {error.digest ? <p style={{ fontFamily: "monospace", fontSize: 12 }}>Reference: {error.digest}</p> : null}
          <button type="button" onClick={reset} style={{ padding: "8px 16px" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
