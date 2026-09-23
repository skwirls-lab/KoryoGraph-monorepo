import { spawnSync } from "node:child_process";

// Ensures stripe-mock (Stripe's official API mock) is listening for the payments unit tests.
// Pinned by digest (stripe-mock 0.203.0). usage: npm run stripe:mock
const IMAGE = "stripe/stripe-mock@sha256:90e2cb49557449a5da30d19f08780667b97a292862b017d56e1276adc5c63587";
const NAME = "koryo-stripe-mock";
const PORT = process.env.STRIPE_MOCK_PORT ?? "12111";

async function up(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${PORT}/v1/balance`, { headers: { authorization: "Bearer sk_test_123" } });
    return res.ok;
  } catch {
    return false;
  }
}

if (!(await up())) {
  const started = spawnSync("docker", ["start", NAME], { stdio: "ignore" }).status === 0;
  if (!started) {
    const run = spawnSync("docker", ["run", "-d", "--name", NAME, "-p", `${PORT}:12111`, IMAGE], { stdio: "inherit" });
    if (run.status !== 0) {
      console.error("Couldn't start stripe-mock with Docker. Start it manually: docker run -p 12111:12111 stripe/stripe-mock");
      process.exit(1);
    }
  }
  for (let i = 0; i < 30 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await up())) {
    console.error(`stripe-mock did not come up on :${PORT}`);
    process.exit(1);
  }
}
console.log(`stripe-mock is listening on :${PORT}`);
