// Gate helper (M4+): e2e must run with AI_TRANSPORT=fixture. If a dev server is already running (Playwright
// reuses it), make sure it is in fixture mode; otherwise Playwright starts one with the forced env.
const base = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? "3100"}`;
try {
  const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(20_000) });
  const body = (await res.json()) as { ai?: { transport?: string } };
  if (body.ai?.transport !== "fixture") {
    console.error(`The server at ${base} runs AI in "${body.ai?.transport ?? "unknown"}" mode. Restart it with AI_TRANSPORT=fixture (or stop it and let the gate start one).`);
    process.exit(1);
  }
  console.log(`AI transport at ${base}: fixture`);
} catch {
  console.log(`No server at ${base}; Playwright will start one with AI_TRANSPORT=fixture.`);
}
